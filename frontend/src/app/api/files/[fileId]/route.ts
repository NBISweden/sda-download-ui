import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getConfig } from "@/app/lib/config";

// Predictable JSON error response for the frontend, with no caching.
function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: message, status },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

// Extract a human-readable message from an application/problem+json body.
async function extractProblemDetail(
  upstream: Response,
): Promise<string | null> {
  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.includes("json")) return null;
  try {
    const problem = await upstream.json();
    if (typeof problem?.detail === "string") return problem.detail;
    if (typeof problem?.title === "string") return problem.title;
  } catch {
    // Ignore malformed body and fall back to a generic message.
  }
  return null;
}

function translateUpstreamError(
  upstream: Response,
  detail: string | null,
): NextResponse {
  const fallback =
    upstream.status === 401
      ? "Authentication with the download backend failed. Please sign in again."
      : upstream.status === 403
        ? "You do not have access to this file (or it does not exist)."
        : upstream.status === 416
          ? "The requested byte range is not satisfiable."
          : `Download failed with status ${upstream.status}.`;
  return errorResponse(upstream.status, detail || fallback);
}

function buildContentDisposition(filename: string): string {
  // filename is assumed to be HTTP-header-safe
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`;
}

function getFallbackFilename(filePath: string | null, fileId: string): string {
  if (filePath) {
    const basename = filePath.split("/").pop();
    if (basename) return basename;
  }
  return `${fileId}.c4gh`; //2nd fallback
}

type Range = { start: number; end: number };

// Parse a single-range "bytes=<start>-<end?>" header in combined-stream space.
// Returns null if not present/unparseable or "unsatisfiable" if start >= totalLen or start > end.
function parseRange(
  header: string | null,
  totalLen: number,
): Range | "unsatisfiable" | null {
  if (!header) return null;

  const m = header.match(/^bytes=(\d+)-(\d*)$/);
  if (!m) return null;

  const start = parseInt(m[1], 10);
  const end = m[2] ? parseInt(m[2], 10) : totalLen - 1;
  if (start >= totalLen || start > end) return "unsatisfiable";

  return { start, end: Math.min(end, totalLen - 1) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const sessionData = await getSession();
  const filePath = request.nextUrl.searchParams.get("name");

  if (!sessionData?.token) {
    return errorResponse(401, "Not authenticated.");
  }

  if (!sessionData.publicKey?.key) {
    return errorResponse(
      400,
      "No Crypt4GH public key configured. Upload your public key on the profile page before downloading files.",
    );
  }

  const { sdaBaseUrl } = await getConfig();
  const headerAuth = {
    Authorization: `Bearer ${sessionData.token}`,
    "X-C4GH-Public-Key": sessionData.publicKey.key,
  };
  const contentAuth = {
    Authorization: `Bearer ${sessionData.token}`,
  };
  const headerUrl = `${sdaBaseUrl}/files/${encodeURIComponent(fileId)}/header`;
  const contentUrl = `${sdaBaseUrl}/files/${encodeURIComponent(fileId)}/content`;

  // Probe both sub-resources in parallel to learn sizes and the stable content ETag.
  // This is the first step in order to support partial downloads. We rely on headless file (content)
  // ranges(and etag) because the header part is unstable due to re-encryption.
  let headerHead: Response;
  let contentHead: Response;
  try {
    [headerHead, contentHead] = await Promise.all([
      fetch(headerUrl, {
        method: "HEAD",
        headers: headerAuth,
        cache: "no-store",
      }),
      fetch(contentUrl, {
        method: "HEAD",
        headers: contentAuth,
        cache: "no-store",
      }),
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return errorResponse(
      502,
      `Could not reach the download backend: ${message}`,
    );
  }
  if (!headerHead.ok) {
    return translateUpstreamError(
      headerHead,
      await extractProblemDetail(headerHead),
    );
  }
  if (!contentHead.ok) {
    return translateUpstreamError(
      contentHead,
      await extractProblemDetail(contentHead),
    );
  }

  const headerLen = parseInt(
    headerHead.headers.get("content-length") || "0",
    10,
  );
  const contentLen = parseInt(
    contentHead.headers.get("content-length") || "0",
    10,
  );
  const totalLen = headerLen + contentLen;
  const etag = contentHead.headers.get("etag");

  // Use If-Range only when it matches the (stable, content-derived) ETag.
  // This is step 2 in supporting partial downloads.
  const ifRange = request.headers.get("if-range");
  const honorRange = !ifRange || (etag !== null && ifRange === etag);
  const rangeHeader = honorRange ? request.headers.get("range") : null;
  const range = parseRange(rangeHeader, totalLen);

  if (range === "unsatisfiable") {
    return NextResponse.json(
      {
        error: "The requested byte range is not satisfiable.",
        status: 416,
      },
      {
        status: 416,
        headers: {
          "cache-control": "no-store",
          "content-range": `bytes */${totalLen}`,
        },
      },
    );
  }

  // Decide which upstream bodies we need. Note that no range is supported for the header by the backend API.
  // The header is very small so it will be downloaded if needed and range will be adjusted.
  // This is step 3 in supporting partial downloads.
  const effective: Range = range || { start: 0, end: totalLen - 1 };
  const needHeader = effective.start < headerLen;
  const needContent = effective.end >= headerLen;

  // Fetch (and buffer) just the slice of the header we need.
  let headerSlice: Uint8Array | null = null;
  if (needHeader) {
    const r = await fetch(headerUrl, {
      headers: headerAuth,
      cache: "no-store",
    });
    if (!r.ok) {
      return translateUpstreamError(r, await extractProblemDetail(r));
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const sliceStart = effective.start;
    const sliceEnd = Math.min(effective.end, headerLen - 1);
    headerSlice = buf.subarray(sliceStart, sliceEnd + 1);
  }

  // Stream the content portion with a translated Range if it's a sub-slice.
  let contentBody: ReadableStream<Uint8Array> | null = null;
  if (needContent) {
    const contentStart = Math.max(0, effective.start - headerLen);
    const contentEnd = effective.end - headerLen;
    const wantsSubSlice = contentStart > 0 || contentEnd < contentLen - 1;
    const headers: Record<string, string> = { ...contentAuth };
    if (wantsSubSlice) {
      headers["Range"] = `bytes=${contentStart}-${contentEnd}`;
    }
    const r = await fetch(contentUrl, { headers, cache: "no-store" });
    if (!r.ok) {
      return translateUpstreamError(r, await extractProblemDetail(r));
    }
    contentBody = r.body;
  }

  // Stitch header slice (if any) + content stream (if any).
  // This is step 4 in supporting partial downloads.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (headerSlice) controller.enqueue(headerSlice);
      if (contentBody) {
        const reader = contentBody.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
        } catch (e) {
          controller.error(e);
          return;
        }
      }
      controller.close();
    },
  });

  const responseHeaders = new Headers();
  responseHeaders.set("content-type", "application/octet-stream");
  responseHeaders.set("accept-ranges", "bytes");
  responseHeaders.set("cache-control", "no-store");
  if (etag) responseHeaders.set("etag", etag);
  responseHeaders.set(
    "content-disposition",
    buildContentDisposition(getFallbackFilename(filePath, fileId)),
  );

  const responseLen = effective.end - effective.start + 1;
  responseHeaders.set("content-length", String(responseLen));

  if (range) {
    responseHeaders.set(
      "content-range",
      `bytes ${range.start}-${range.end}/${totalLen}`,
    );
    return new NextResponse(stream, { status: 206, headers: responseHeaders });
  }
  return new NextResponse(stream, { status: 200, headers: responseHeaders });
}
