import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import * as crypto from "crypto";
import { getSession } from "@/app/lib/serverToken";
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
  parseRange,
} from "@/app/lib/proxy";
import {
  planEntry,
  TAR_BLOCK_SIZE,
  TAR_TRAILER_LEN,
  type PlannedEntry,
} from "@/app/lib/tar";
import { MAX_TAR_SELECTION } from "@/app/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER_FETCH_CONCURRENCY = 32;
const TRAILER = new Uint8Array(TAR_TRAILER_LEN);
const ZEROS_512 = new Uint8Array(TAR_BLOCK_SIZE);

// Bump if the encoded byte layout for the same inputs would change.
// Invalidates all clients' If-Range validators.
const TAR_LAYOUT_VERSION = "sda-tar-v1";

type ResolvedEntry = {
  file: DatasetFile;
  headerBytes: Uint8Array;
  contentLen: number;
  contentEtag: string;
  plan: PlannedEntry;
};

type StaticTag = "pax" | "ustar" | "c4gh-header" | "padding" | "trailer";

type Region =
  | {
      kind: "static";
      tag: StaticTag;
      bytes: Uint8Array;
      start: number;
      len: number;
    }
  | { kind: "content"; entryIndex: number; start: number; len: number };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> },
) {
  return handle(request, await params, "GET");
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> },
) {
  return handle(request, await params, "HEAD");
}

async function handle(
  request: NextRequest,
  { datasetId }: { datasetId: string },
  method: "GET" | "HEAD",
): Promise<Response> {
  const signal = request.signal;

  const sessionData = await getSession();
  if (!sessionData?.token) return errorResponse(401, "Not authenticated.");
  if (!sessionData.publicKey?.key) {
    return errorResponse(
      400,
      "No Crypt4GH public key configured. Upload your public key on the profile page before downloading files.",
    );
  }

  const fileIdsParam = request.nextUrl.searchParams.get("fileIds");
  // The selectedFileIds == null case is left here to wire a full dataset download later.
  let selectedFileIds: Set<string> | null = null;
  if (fileIdsParam !== null) {
    const ids = fileIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ids.length === 0) {
      return errorResponse(400, "fileIds query parameter is empty.");
    }
    if (ids.length > MAX_TAR_SELECTION) {
      return errorResponse(
        400,
        `Too many fileIds; maximum is ${MAX_TAR_SELECTION}.`,
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
  ) // The selectedFileIds == null case is left here to wire a full dataset download later.
    .sort((a, b) =>
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

  // Guard the whole-dataset path. The selection path is already capped by
  // the fileIds check above; this catches a request with no fileIds against
  // a dataset that happens to have more files than we can handle in one go.
  if (files.length > MAX_TAR_SELECTION) {
    return errorResponse(
      400,
      `Dataset has ${files.length} files; per-request TAR is capped at ${MAX_TAR_SELECTION}. Select a subset of files instead.`,
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
    resolved = await probeAll({
      files,
      token,
      publicKey,
      sdaBaseUrl,
      mtime,
      signal,
    });
  } catch (e) {
    if (e instanceof Response) return e;

    if (signal.aborted) {
      return new Response(null, { status: 400 });
    }

    const msg = e instanceof Error ? e.message : "Unknown error occurred";
    return errorResponse(502, `Could not reach the download backend: ${msg}`);
  }

  const totalLen =
    resolved.reduce((sum, r) => sum + r.plan.entryLen, 0) + TAR_TRAILER_LEN;
  const regions = buildRegions(resolved, totalLen);
  const etag = computeTarEtag(resolved, sessionData.publicKey.pemChecksum);

  // If-Range only honors the Range when the validator still matches.
  const ifRange = request.headers.get("if-range");
  const honorRange = !ifRange || ifRange === etag;
  const rangeHeader = honorRange ? request.headers.get("range") : null;
  const range = parseRange(rangeHeader, totalLen);

  if (range === "unsatisfiable") {
    return NextResponse.json(
      { error: "The requested byte range is not satisfiable.", status: 416 },
      {
        status: 416,
        headers: {
          "cache-control": "no-store",
          "content-range": `bytes */${totalLen}`,
        },
      },
    );
  }

  // Refuse to resume from a position that falls inside a c4gh header
  // to avoid corrupting the tar since header bytes are unstable.
  // Same rule as the per-file download in the proxy.
  const effectiveRange =
    range && !isInsideC4ghHeader(regions, range.start) ? range : null;

  const isPartial = effectiveRange !== null;
  const start = effectiveRange ? effectiveRange.start : 0;
  const end = effectiveRange ? effectiveRange.end : totalLen - 1;
  const length = end - start + 1;

  const responseHeaders = new Headers({
    "content-type": "application/x-tar",
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    etag,
    "content-disposition": buildContentDisposition(`${datasetId}.tar`),
    "content-length": String(length),
  });
  if (isPartial) {
    responseHeaders.set("content-range", `bytes ${start}-${end}/${totalLen}`);
  }

  if (method === "HEAD") {
    return new Response(null, {
      status: isPartial ? 206 : 200,
      headers: responseHeaders,
    });
  }

  async function* emitTar(): AsyncGenerator<Buffer> {
    let pos = start;
    let idx = findRegionIndex(regions, pos);
    const endExclusive = end + 1;

    // Only emit chunks that do not terminate at a c4gh-header boundary.
    // When we'd yield a c4gh header region, we hold it back and concatenate
    // with the next chunk. The consumer never observes a yield boundary mid-header,
    // so the natural pause point can't land inside one. This just avoids ever offering
    // the browser the chance to resume mid-header.
    let pendingHeader: Buffer | null = null;

    while (pos < endExclusive && idx < regions.length) {
      const r = regions[idx];
      const within = pos - r.start;
      const want = Math.min(r.len - within, endExclusive - pos);

      if (r.kind === "static") {
        // Use the c4gh header bytes (or pax/ustar/padding/trailer) we already
        // have from the preparatory phase. Slice for partial regions.
        const view = r.bytes.subarray(within, within + want);
        const slice = Buffer.from(
          view.buffer,
          view.byteOffset,
          view.byteLength,
        );
        if (r.tag === "c4gh-header") {
          pendingHeader = pendingHeader
            ? Buffer.concat([pendingHeader, slice])
            : slice;
        } else {
          yield pendingHeader ? Buffer.concat([pendingHeader, slice]) : slice;
          pendingHeader = null;
        }
        pos += want;
        idx++;
        continue;
      }

      // Stream the content, verify the content length here to ensure data integrity.
      const e = resolved[r.entryIndex];
      const contentUrl = `${sdaBaseUrl}/files/${encodeURIComponent(e.file.fileId)}/content`;
      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const partial = within > 0 || want < r.len;
      if (partial) {
        reqHeaders["Range"] = `bytes=${within}-${within + want - 1}`;
      }
      const contentResp = await fetch(contentUrl, {
        headers: reqHeaders,
        cache: "no-store",
        signal,
      });
      if (!contentResp.ok || !contentResp.body) {
        throw new Error(
          `Failed to GET content for ${e.file.fileId}: ${contentResp.status}`,
        );
      }
      const reader = contentResp.body.getReader();
      let streamed = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            const useLen = Math.min(value.byteLength, want - streamed);
            const slice = Buffer.from(value.buffer, value.byteOffset, useLen);
            streamed += useLen;
            if (pendingHeader) {
              yield Buffer.concat([pendingHeader, slice]);
              pendingHeader = null;
            } else {
              yield slice;
            }
            if (streamed >= want) break;
          }
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          // best-effort
        }
      }
      if (streamed !== want) {
        throw new Error(
          `Content length mismatch for ${e.file.fileId}: expected ${want}, got ${streamed}`,
        );
      }
      pos += want;
      idx++;
    }

    // Flush any pendingHeader bytes (only possible if a c4gh header sits at the very
    // end of the requested range and there's nothing after it to coalesce with).
    if (pendingHeader) yield pendingHeader;
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
    if ((err as { name?: string })?.name === "AbortError" || signal.aborted) {
      // Client disconnected mid-stream; not actionable.
      return;
    }
    console.error(`tar:${datasetId}:stream error`, err);
  });

  const webStream = Readable.toWeb(
    nodeReadable,
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: isPartial ? 206 : 200,
    headers: responseHeaders,
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
  signal: AbortSignal;
}): Promise<ResolvedEntry[]> {
  const { files, token, publicKey, sdaBaseUrl, mtime, signal } = opts;
  const out: ResolvedEntry[] = new Array(files.length);
  let next = 0;
  const workerCount = Math.min(HEADER_FETCH_CONCURRENCY, files.length);

  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = next++;
      if (i >= files.length) return;
      out[i] = await probeOne(
        files[i],
        token,
        publicKey,
        sdaBaseUrl,
        mtime,
        signal,
      );
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
  signal: AbortSignal,
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
      signal,
    }),
    fetch(contentUrl, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal,
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
  // The /content ETag is recipient-independent and stable per backend api specification.
  const contentEtag = contentHead.headers.get("etag") || `"${file.fileId}"`;
  const plan = planEntry(
    file.filePath,
    headerBytes.byteLength + contentLen,
    mtime,
  );

  return { file, headerBytes, contentLen, contentEtag, plan };
}

// ETag bound to encoder version, recipient key, and per-entry id + upstream content ETag
// + path. We deliberately exclude c4gh header bytes since we disallow mid-header resumes
// since these headers are unstable per spec.
function computeTarEtag(entries: ResolvedEntry[], pemChecksum: string): string {
  const h = crypto.createHash("sha256");
  h.update(`${TAR_LAYOUT_VERSION}\n`);
  h.update(`${pemChecksum}\n`);
  for (const e of entries) {
    h.update(`${e.file.fileId}\t${e.contentEtag}\t${e.file.filePath}\n`);
  }
  return `"${h.digest("hex").slice(0, 32)}"`;
}

// Build the byte layout map: each region is either an in-memory `static`
// block (pax/ustar/c4gh-header/padding/trailer) or a `content` placeholder
// that streams from /content.
function buildRegions(entries: ResolvedEntry[], totalLen: number): Region[] {
  const regions: Region[] = [];
  let cursor = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.plan.paxBlock) {
      regions.push({
        kind: "static",
        tag: "pax",
        bytes: e.plan.paxBlock,
        start: cursor,
        len: e.plan.paxBlock.length,
      });
      cursor += e.plan.paxBlock.length;
    }
    regions.push({
      kind: "static",
      tag: "ustar",
      bytes: e.plan.ustarBlock,
      start: cursor,
      len: TAR_BLOCK_SIZE,
    });
    cursor += TAR_BLOCK_SIZE;
    if (e.headerBytes.length > 0) {
      regions.push({
        kind: "static",
        tag: "c4gh-header",
        bytes: e.headerBytes,
        start: cursor,
        len: e.headerBytes.length,
      });
      cursor += e.headerBytes.length;
    }
    if (e.contentLen > 0) {
      regions.push({
        kind: "content",
        entryIndex: i,
        start: cursor,
        len: e.contentLen,
      });
      cursor += e.contentLen;
    }
    if (e.plan.paddingLen > 0) {
      // Pad the entry to a 512-byte boundary so the next entry's header
      // block starts on a clean offset (TAR requirement).
      regions.push({
        kind: "static",
        tag: "padding",
        bytes: ZEROS_512.subarray(0, e.plan.paddingLen),
        start: cursor,
        len: e.plan.paddingLen,
      });
      cursor += e.plan.paddingLen;
    }
  }
  // TAR trailer: two zero blocks
  regions.push({
    kind: "static",
    tag: "trailer",
    bytes: TRAILER,
    start: cursor,
    len: TAR_TRAILER_LEN,
  });
  cursor += TAR_TRAILER_LEN;
  if (cursor !== totalLen) {
    throw new Error(
      `Internal error: region cursor ${cursor} !== totalLen ${totalLen}`,
    );
  }
  return regions;
}

function findRegionIndex(regions: Region[], pos: number): number {
  let lo = 0;
  let hi = regions.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const r = regions[mid];
    if (r.start + r.len <= pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Returns true if range position lies inside a re-encrypted c4gh header region.
function isInsideC4ghHeader(regions: Region[], pos: number): boolean {
  const idx = findRegionIndex(regions, pos);
  const r = regions[idx];
  if (!r) return false;
  if (r.start > pos || pos >= r.start + r.len) return false;
  return r.kind === "static" && r.tag === "c4gh-header";
}
