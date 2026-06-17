import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getConfig } from "@/app/lib/config";
import {
  errorResponse,
  extractProblemDetail,
  translateUpstreamError,
  buildContentDisposition,
} from "@/app/lib/proxy";

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
    return new NextResponse(null, {
      status: 307,
      headers: { location: "/userinfo" },
    });
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
  // Bind the ETag to the recipient public key so that resumes only succeed when the same
  // key is in use.
  const contentEtagRaw = contentHead.headers.get("etag");
  const etag = contentEtagRaw
    ? `"${contentEtagRaw.replace(/^"|"$/g, "")}-${sessionData.publicKey.pemChecksum}"`
    : null;

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

  // If the requested range overlaps the header, ignore the range and thus serve the full file.
  const effectiveRange = range && range.start >= headerLen ? range : null;
  const isFullDownload = effectiveRange === null;

  // Fetch the header only when we're serving a full download.
  let headerBody: Uint8Array | null = null;
  if (isFullDownload) {
    const r = await fetch(headerUrl, {
      headers: headerAuth,
      cache: "no-store",
    });
    if (!r.ok) {
      return translateUpstreamError(r, await extractProblemDetail(r));
    }
    headerBody = new Uint8Array(await r.arrayBuffer());
  }

  // Stream the content portion, translating the Range into content-local
  // offsets when present. This is step 3 in supporting partial downloads.
  const contentStart = effectiveRange ? effectiveRange.start - headerLen : 0;
  const contentEnd = effectiveRange
    ? effectiveRange.end - headerLen
    : contentLen - 1;
  const wantsSubSlice = contentStart > 0 || contentEnd < contentLen - 1;

  const contentHeaders: Record<string, string> = { ...contentAuth };
  if (wantsSubSlice) {
    contentHeaders["Range"] = `bytes=${contentStart}-${contentEnd}`;
  }
  const contentResp = await fetch(contentUrl, {
    headers: contentHeaders,
    cache: "no-store",
  });
  if (!contentResp.ok) {
    return translateUpstreamError(
      contentResp,
      await extractProblemDetail(contentResp),
    );
  }
  const contentBody = contentResp.body;

  // Stitch header bytes (full download only) + content stream.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (headerBody) controller.enqueue(headerBody);
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

  if (effectiveRange) {
    const responseLen = effectiveRange.end - effectiveRange.start + 1;
    responseHeaders.set("content-length", String(responseLen));
    responseHeaders.set(
      "content-range",
      `bytes ${effectiveRange.start}-${effectiveRange.end}/${totalLen}`,
    );
    return new NextResponse(stream, { status: 206, headers: responseHeaders });
  }

  responseHeaders.set("content-length", String(totalLen));
  return new NextResponse(stream, { status: 200, headers: responseHeaders });
}
