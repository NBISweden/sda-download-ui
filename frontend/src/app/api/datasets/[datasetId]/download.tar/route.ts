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
import { planEntry, TAR_BLOCK_SIZE, TAR_TRAILER_LEN, type PlannedEntry } from "@/app/lib/tar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER_FETCH_CONCURRENCY = 32;
const MAX_SELECTED_FILE_IDS = 1000;
const TRAILER = new Uint8Array(TAR_TRAILER_LEN);

type ResolvedEntry = {
  file: DatasetFile;
  headerBytes: Uint8Array;
  contentLen: number;
  plan: PlannedEntry;
};

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

  // Preparation before opening the stream. GET each header (small) + HEAD each /content
  // with bounded concurrency. This gives us per-entry headerBytes (reused later) and the
  // total TAR length so we can advertise Content-Length to the browser.
  let resolved: ResolvedEntry[];
  try {
    resolved = await probeAll({files, token, publicKey, sdaBaseUrl, mtime});
  } catch (e) {
    if (e instanceof Response) return e;

    const msg = e instanceof Error ? e.message : "Unknown error occurred";
    return errorResponse(502, `Could not reach the download backend: ${msg}`);
  }

  const totalLen = resolved.reduce((sum, r) => sum + r.plan.entryLen, 0) + TAR_TRAILER_LEN;

  async function* emitTar(): AsyncGenerator<Buffer> {
    for (const r of resolved) {
      if (r.plan.paxBlock) yield Buffer.from(r.plan.paxBlock);
      yield Buffer.from(r.plan.ustarBlock);

      // Use the c4gh header bytes we already have from preparatory phase.
      if (r.headerBytes.byteLength > 0) yield Buffer.from(r.headerBytes);

      // Stream the content, verify the content length here to ensure data integrity.
      const contentUrl = `${sdaBaseUrl}/files/${encodeURIComponent(r.file.fileId)}/content`;
      const contentResp = await fetch(contentUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!contentResp.ok || !contentResp.body) {
        throw new Error(
          `Failed to GET content for ${r.file.fileId}: ${contentResp.status}`,
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
      if (streamed !== r.contentLen) {
        throw new Error(
          `Content length mismatch for ${r.file.fileId}: expected ${r.contentLen}, got ${streamed}`,
        );
      }

      // Pad the entry to a 512-byte boundary so the next entry's header
      // block starts on a clean offset (TAR requirement).
      if (r.plan.paddingLen > 0) yield Buffer.alloc(r.plan.paddingLen);
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

  const webStream = Readable.toWeb(
    nodeReadable,
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "content-type": "application/x-tar",
      "content-length": String(totalLen),
      "cache-control": "no-store",
      "content-disposition": buildContentDisposition(`${datasetId}.tar`),
    },
  });
}

// Run probeOne() over every file with bounded concurrency, preserving the
// input order in the returned array.
async function probeAll(opts: {
  files: DatasetFile[];
  token: string;
  publicKey: string;
  sdaBaseUrl: string;
  mtime: number;
}): Promise<ResolvedEntry[]> {
  const { files, token, publicKey, sdaBaseUrl, mtime } = opts;
  const out: ResolvedEntry[] = new Array(files.length);
  let next = 0;
  const workerCount = Math.min(HEADER_FETCH_CONCURRENCY, files.length);

  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = next++;
      if (i >= files.length) return;
      out[i] = await probeOne(files[i], token, publicKey, sdaBaseUrl, mtime);
    }
  });
  await Promise.all(workers);
  return out;
}

// Per file preparation before streaming: GET its re-encrypted Crypt4GH header and HEAD
// its content. Combine the two into a ResolvedEntry that fully describes the file's TAR entry.
async function probeOne(
  file: DatasetFile,
  token: string,
  publicKey: string,
  sdaBaseUrl: string,
  mtime: number,
): Promise<ResolvedEntry> {
  const headerUrl = `${sdaBaseUrl}/files/${encodeURIComponent(file.fileId)}/header`;
  const contentUrl = `${sdaBaseUrl}/files/${encodeURIComponent(file.fileId)}/content`;

  const [headerResp, contentHead] = await Promise.all([
    fetch(headerUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-C4GH-Public-Key": publicKey,
      },
      cache: "no-store",
    }),
    fetch(contentUrl, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  ]);

  if (!headerResp.ok) {
    throw translateUpstreamError(
      headerResp,
      await extractProblemDetail(headerResp),
    );
  }
  if (!contentHead.ok) {
    throw translateUpstreamError(
      contentHead,
      await extractProblemDetail(contentHead),
    );
  }

  const headerBytes = new Uint8Array(await headerResp.arrayBuffer());
  const contentLen = parseInt(
    contentHead.headers.get("content-length") || "0",
    10,
  );
  const plan = planEntry(
    file.filePath,
    headerBytes.byteLength + contentLen,
    mtime,
  );

  return { file, headerBytes, contentLen, plan };
}
