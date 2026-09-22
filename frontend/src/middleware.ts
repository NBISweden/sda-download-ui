import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Detect whether this request came in over HTTPS and set the CSP below accordingly.
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";

  // - 'strict-dynamic' + nonce covers Next.js's inline hydration/streaming
  //   scripts and any scripts they subsequently load, without listing hosts.
  // - style-src needs 'unsafe-inline': Bootstrap, Radix UI and any React
  //   `style={{...}}` prop (e.g. the progress bar width) inject inline styles.
  //   Nonce-based styles are not supported for style attributes.
  // - connect-src 'self' is enough: the client only talks to /api/*.
  // - form-action 'self': next-auth POSTs to /api/auth/signin/... before it
  //   redirects to the OIDC provider (redirects are exempt from form-action).
  // - frame-ancestors 'none': the app doesn't need to be embedded.
  // Note: X-Content-Type-Options: nosniff is set globally via next.config.ts.
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,  //optional, covered by default-src 'self'
    `connect-src 'self'`, // optional, covered by default-src 'self'
    `form-action 'self'`, // optional, covered by default-src 'self'
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    ...(isHttps ? [`upgrade-insecure-requests`] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads this to nonce its injected <script> tags.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Skip API routes (browsers don't render those; CSP doesn't apply),
    // static assets and prefetches.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
