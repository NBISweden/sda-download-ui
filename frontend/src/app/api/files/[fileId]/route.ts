import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getConfig } from "@/app/lib/config";

// Response headers we want to forward from the backend to the browser so
// that streaming, resuming, and the "save as" filename all work correctly.
const FORWARDED_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const sessionData = await getSession();

  if (!sessionData?.token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!sessionData.publicKey?.key) {
    return NextResponse.json(
      {
        error:
          "No Crypt4GH public key configured. Upload your public key on the profile page before downloading files.",
      },
      { status: 400 },
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
    return NextResponse.json(
      { error: `Could not reach the download backend: ${message}` },
      { status: 502 },
    );
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

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
