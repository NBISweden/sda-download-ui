import "server-only";
import { NextResponse } from "next/server";

// Predictable JSON error response for the frontend, with no caching.
export function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: message, status },
    { status, headers: { "cache-control": "no-store" } },
  );
}

// Extract a human-readable message from an application/problem+json body.
export async function extractProblemDetail(
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

export function translateUpstreamError(
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

export function buildContentDisposition(filename: string): string {
  // filename is assumed to be HTTP-header-safe
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`;
}
