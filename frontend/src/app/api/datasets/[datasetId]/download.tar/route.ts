import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { getSession } from "@/app/lib/session";
import { getConfig } from "@/app/lib/config";
import {
  fetchDatasetMetadata,
  fetchDatasetFiles,
  fetchAll,
  type DatasetFile,
  type DatasetMetadata,
} from "@/app/actions/datasets";
import {
  errorResponse,
  extractProblemDetail,
  translateUpstreamError,
  buildContentDisposition,
} from "@/app/lib/proxy";
import { planEntry, TAR_BLOCK_SIZE, TAR_TRAILER_LEN } from "@/app/lib/tar";

// Node runtime gives us a real Node Readable, which Next.js streams to the
// socket without coalescing. The Web ReadableStream path is fine here too,
// but using Node lets us share the same plumbing with step 2.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SELECTED_FILE_IDS = 1000;
const TRAILER = new Uint8Array(TAR_TRAILER_LEN);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> },
) {
  const { datasetId } = await params;

  const sessionData = await getSession();
  if (!sessionData?.token) return errorResponse(401, "Not authenticated.");
  if (!sessionData.publicKey?.key) {
    return errorResponse(
      400,
      "No Crypt4GH public key configured. Upload your public key on the profile page before downloading files.",
    );
  }

  const fileIdsParam = request.nextUrl.searchParams.get("fileIds");
  let selectedFileIds: Set<string> | null = null;
  if (fileIdsParam !== null) {
    const ids = fileIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ids.length === 0) {
      return errorResponse(400, "fileIds query parameter is empty.");
    }
    if (ids.length > MAX_SELECTED_FILE_IDS) {
      return errorResponse(
        400,
        `Too many fileIds; maximum is ${MAX_SELECTED_FILE_IDS}.`,
      );
    }
    selectedFileIds = new Set(ids);
  }

  const { sdaBaseUrl } = await getConfig();
  const token = sessionData.token;
  const publicKey = sessionData.publicKey.key;

  let dataset: DatasetMetadata;
  let allFiles: DatasetFile[];
  try {
    dataset = await fetchDatasetMetadata(token, datasetId);
    allFiles = await fetchAll(async (pageToken) => {
      const page = await fetchDatasetFiles(token, datasetId, pageToken);
      return { items: page.files, nextPageToken: page.nextPageToken };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error occurred";
    return errorResponse(502, `Could not reach the download backend: ${msg}`);
  }

  // We need a deterministic order for the files to ensure a stable TAR layout and ETag (for resuming),
  // here we chose to sort by filePath but any deterministic order should work work.
  const files = (
    selectedFileIds
      ? allFiles.filter((f) => selectedFileIds!.has(f.fileId))
      : allFiles
  ).sort((a, b) =>
    a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0,
  );

  if (files.length === 0) {
    return errorResponse(
      400,
      selectedFileIds
        ? "No files match the requested fileIds."
        : "Dataset has no files to download.",
    );
  }

  // needed for TAR header "mtime" field; using dataset creation date
  const datasetEpoch = new Date(dataset.date).getTime();
  const mtime =
    Number.isFinite(datasetEpoch) && datasetEpoch >= 0
      ? Math.floor(datasetEpoch / 1000)
      : 0;

  async function* emitTar(): AsyncGenerator<Buffer> {
    for (const file of files) {
      const headerUrl = `${sdaBaseUrl}/files/${encodeURIComponent(file.fileId)}/header`;
      const contentUrl = `${sdaBaseUrl}/files/${encodeURIComponent(file.fileId)}/content`;

      // re-encrypted header (small, fully buffered)
      const headerResp = await fetch(headerUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-C4GH-Public-Key": publicKey,
        },
        cache: "no-store",
      });
      if (!headerResp.ok) {
        throw new Error(
          `Failed to fetch header for ${file.fileId}: ${headerResp.status}`,
        );
      }
      const headerBytes = new Uint8Array(await headerResp.arrayBuffer());

      // 2) HEAD content for size
      const contentHead = await fetch(contentUrl, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!contentHead.ok) {
        throw new Error(
          `Failed to HEAD content for ${file.fileId}: ${contentHead.status}`,
        );
      }
      const contentLen = parseInt(
        contentHead.headers.get("content-length") || "0",
        10,
      );

      // Plan + emit TAR header block(s)
      const fileDataLen = headerBytes.byteLength + contentLen;
      const plan = planEntry(file.filePath, fileDataLen, mtime);
      if (plan.paxBlock) yield Buffer.from(plan.paxBlock);
      yield Buffer.from(plan.ustarBlock);

      // Emit the c4gh header bytes
      if (headerBytes.byteLength > 0) yield Buffer.from(headerBytes);

      // Stream the c4gh content body straight through
      const contentResp = await fetch(contentUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!contentResp.ok || !contentResp.body) {
        throw new Error(
          `Failed to GET content for ${file.fileId}: ${contentResp.status}`,
        );
      }
      const reader = contentResp.body.getReader();
      let streamed = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            streamed += value.byteLength;
            yield Buffer.from(value.buffer, value.byteOffset, value.byteLength);
          }
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          // best-effort
        }
      }
      if (streamed !== contentLen) {
        throw new Error(
          `Content length mismatch for ${file.fileId}: expected ${contentLen}, got ${streamed}`,
        );
      }

      // Pad to a 512-byte boundary
      if (plan.paddingLen > 0) yield Buffer.alloc(plan.paddingLen);
    }

    // TAR trailer: two zero blocks
    yield Buffer.from(TRAILER);
  }

  // Readable.from pulls from the generator on demand. If the browser slows
  // down receiving the TAR, the socket fills up, Node stops asking the
  // generator for more, and the generator stops fetching from upstream.
  // We get end-to-end backpressure without any manual buffering logic.
  const nodeReadable = Readable.from(emitTar(), {
    highWaterMark: 256 * 1024,
  });

  // Surface any upstream failure mid-stream by tearing the response down.
  // We can't change the HTTP status by this point but at least the client
  // won't receive a truncated TAR that looks complete.
  nodeReadable.on("error", (err) => {
    console.error(`tar:${datasetId}:stream error`, err);
  });

  // These are placeholders for handling mid-stream errors more gracefully in the future.
  // The idea is to leave this for the resuming functionality.
  // Checks before the stream opens are in-place already.
  void extractProblemDetail;
  void translateUpstreamError;

  const webStream = Readable.toWeb(
    nodeReadable,
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "content-type": "application/x-tar",
      "cache-control": "no-store",
      "content-disposition": buildContentDisposition(`${datasetId}.tar`),
    },
  });
}
