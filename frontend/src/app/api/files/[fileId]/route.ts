import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getConfig } from "@/app/lib/config";

// Response headers we want to forward from upstream to the browser so
// that streaming, resuming, and "save as" filename work correctly.
// Only forwarded on successful (2xx) responses.
const FORWARDED_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

// Makes a JSON error responses predictable for the frontend to handle, with no caching.
function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: message, status },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

// Extract a human-readable message from the upstream response. Expects an application/problem+json error body.
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const sessionData = await getSession();

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

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${sessionData.token}`,
    "X-C4GH-Public-Key": sessionData.publicKey.key,
  };

  // Forward Range / If-Range so partial downloads and resume continue to work.
  const range = request.headers.get("range");
  if (range) upstreamHeaders["Range"] = range;
  const ifRange = request.headers.get("if-range");
  if (ifRange) upstreamHeaders["If-Range"] = ifRange;

  let upstream: Response;
  try {
    upstream = await fetch(
      `${sdaBaseUrl}/files/${encodeURIComponent(fileId)}`,
      {
        headers: upstreamHeaders,
        cache: "no-store",
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return errorResponse(
      502,
      `Could not reach the download backend: ${message}`,
    );
  }

  // Return upstream errors as clean JSON error response with appropriate status code.
  // Don't attempt to stream the body in this case.
  if (!upstream.ok) {
    const detail = await extractProblemDetail(upstream);
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

  const responseHeaders = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // Make sure browsers actually trigger a file save even if the backend
  // omits Content-Disposition for some reason.
  if (!responseHeaders.has("content-disposition")) {
    responseHeaders.set(
      "content-disposition",
      `attachment; filename="${fileId}.c4gh"`,
    );
  }

  responseHeaders.set("cache-control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
