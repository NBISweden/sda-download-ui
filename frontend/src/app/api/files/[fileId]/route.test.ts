import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import type { SessionData } from "@/app/lib/SessionManager";

/**
 * Unit tests for the file download proxy route.
 *
 * The route is exercised end-to-end by constructing a NextRequest and calling
 * GET() directly. globalThis.fetch and the session/config modules are mocked
 * so the tests run without a backend.
 */

const sdaBaseUrl = "http://test.local";

vi.mock(import("next/server"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    connection: async () => {},
  };
});

vi.mock(import("server-only"), () => {
  return {};
});

vi.mock(import("@/app/lib/config"), () => {
  return {
    getConfig: async () => ({
      sdaBaseUrl,
      sessionSecretPath: "",
    }),
  };
});

// Mutable session result so each test can control what getSession returns.
const sessionState: { current: SessionData | null } = { current: null };

vi.mock(import("@/app/lib/session"), () => {
  return {
    getSession: async () => sessionState.current,
    createOrUpdateSession: async () => undefined,
    getClaims: async () => ({}),
  };
});

function makeRequest(
  fileId: string,
  options: {
    name?: string;
    range?: string;
    ifRange?: string;
  } = {},
) {
  const url = new URL(`http://localhost/api/files/${fileId}`);
  if (options.name) url.searchParams.set("name", options.name);

  const headers = new Headers();
  if (options.range) headers.set("range", options.range);
  if (options.ifRange) headers.set("if-range", options.ifRange);

  const request = new NextRequest(url, { headers });
  const params = Promise.resolve({ fileId });

  return { request, params };
}

function setSession(state: SessionData | null): SessionData | null {
  sessionState.current = state;
  return state;
}

const validSession: SessionData = {
  token: "my-token",
  publicKey: { key: "PUBKEY", pemChecksum: "checksum" },
};

const HEADER_LEN = 124;
const CONTENT_LEN = 1000;
const TOTAL_LEN = HEADER_LEN + CONTENT_LEN;
const ETAG = '"content-etag-abc"';
const PEM_CHECKSUM = "checksum"; // matches validSession.publicKey.pemChecksum
const EXPOSED_ETAG = `"content-etag-abc-${PEM_CHECKSUM}"`;

// Fixed body fixtures so tests can assert on stitched output.
const headerBody = new Uint8Array(HEADER_LEN).map((_, i) => (i + 1) % 256);
const contentBody = new Uint8Array(CONTENT_LEN).map((_, i) => (i + 200) % 256);

type DispatchHandler = (
  url: string,
  init: RequestInit | undefined,
) => Response | Promise<Response>;

function installDispatchedFetch(handler: DispatchHandler) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return Promise.resolve(handler(url, init));
  });
}

function headerHeadResponse() {
  return new Response(null, {
    status: 200,
    headers: { "content-length": String(HEADER_LEN) },
  });
}

function contentHeadResponse() {
  return new Response(null, {
    status: 200,
    headers: {
      "content-length": String(CONTENT_LEN),
      etag: ETAG,
      "accept-ranges": "bytes",
    },
  });
}

function headerGetResponse() {
  return new Response(headerBody, {
    status: 200,
    headers: { "content-length": String(HEADER_LEN) },
  });
}

function contentGetResponse(range?: { start: number; end: number }) {
  if (!range) {
    return new Response(contentBody, {
      status: 200,
      headers: {
        "content-length": String(CONTENT_LEN),
        etag: ETAG,
      },
    });
  }
  const slice = contentBody.subarray(range.start, range.end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      "content-length": String(slice.byteLength),
      "content-range": `bytes ${range.start}-${range.end}/${CONTENT_LEN}`,
      etag: ETAG,
    },
  });
}

function defaultHandler(
  url: string,
  init: RequestInit | undefined,
): Response | Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();

  if (url.endsWith("/header") && method === "HEAD") return headerHeadResponse();
  if (url.endsWith("/content") && method === "HEAD")
    return contentHeadResponse();

  if (url.endsWith("/header") && method === "GET") return headerGetResponse();

  if (url.endsWith("/content") && method === "GET") {
    const rangeHdr = new Headers(init?.headers).get("range");
    if (rangeHdr) {
      const m = rangeHdr.match(/^bytes=(\d+)-(\d+)$/);
      if (m) {
        return contentGetResponse({
          start: parseInt(m[1], 10),
          end: parseInt(m[2], 10),
        });
      }
    }
    return contentGetResponse();
  }

  return new Response("unmocked URL", { status: 500 });
}

async function readAll(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

describe("GET /api/files/[fileId]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionState.current = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns 401 when no session token is present", async () => {
    setSession(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      error: "Not authenticated.",
      status: 401,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("returns 401 when resuming a download without a session token", async () => {
    setSession(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { request, params } = makeRequest("file-1", {
      range: "bytes=100-",
    });

    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();

    await expect(response.json()).resolves.toMatchObject({
      error: "Not authenticated.",
      status: 401,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("returns 400 when session has no public key", async () => {
    setSession({ token: "my-token", publicKey: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ status: 400 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("probes /header with auth+public-key and /content with auth only", async () => {
    setSession(validSession);
    const spy = installDispatchedFetch(defaultHandler);

    const { request, params } = makeRequest("file-1");
    await GET(request, { params });

    const calls = spy.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: (init?.method || "GET").toUpperCase(),
      headers: new Headers(init?.headers),
    }));

    const headerHead = calls.find(
      (c) => c.url.endsWith("/header") && c.method === "HEAD",
    );
    const contentHead = calls.find(
      (c) => c.url.endsWith("/content") && c.method === "HEAD",
    );

    expect(headerHead).toBeDefined();
    expect(contentHead).toBeDefined();
    expect(headerHead!.url).toBe(`${sdaBaseUrl}/files/file-1/header`);
    expect(contentHead!.url).toBe(`${sdaBaseUrl}/files/file-1/content`);

    expect(headerHead!.headers.get("authorization")).toBe("Bearer my-token");
    expect(headerHead!.headers.get("x-c4gh-public-key")).toBe("PUBKEY");
    expect(contentHead!.headers.get("authorization")).toBe("Bearer my-token");
    expect(contentHead!.headers.get("x-c4gh-public-key")).toBeNull();
  });

  // Happy path: full file

  test("returns 200 with stitched header+content and correct headers", async () => {
    setSession(validSession);
    installDispatchedFetch(defaultHandler);

    const { request, params } = makeRequest("file-1", {
      name: "samples/sample1.cram.c4gh",
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("content-length")).toBe(String(TOTAL_LEN));
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("etag")).toBe(EXPOSED_ETAG);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; " +
        'filename="sample1.cram.c4gh"; ' +
        "filename*=UTF-8''sample1.cram.c4gh",
    );
    expect(response.headers.get("content-range")).toBeNull();

    const body = await readAll(response.body);
    expect(body.byteLength).toBe(TOTAL_LEN);
    expect(body.subarray(0, HEADER_LEN)).toEqual(headerBody);
    expect(body.subarray(HEADER_LEN)).toEqual(contentBody);
  });

  test("fallback Content-Disposition uses <fileId>.c4gh when no name given", async () => {
    setSession(validSession);
    installDispatchedFetch(defaultHandler);

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.headers.get("content-disposition")).toBe(
      "attachment; " +
        'filename="file-1.c4gh"; ' +
        "filename*=UTF-8''file-1.c4gh",
    );
  });

  // Resuming with range entirely inside the content

  test("Range entirely inside the content → 206, no /header GET, translated Range", async () => {
    setSession(validSession);
    const spy = installDispatchedFetch(defaultHandler);

    const start = HEADER_LEN + 100;
    const end = HEADER_LEN + 199;

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${start}-${end}`,
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-length")).toBe("100");
    expect(response.headers.get("content-range")).toBe(
      `bytes ${start}-${end}/${TOTAL_LEN}`,
    );

    const body = await readAll(response.body);
    expect(body).toEqual(contentBody.subarray(100, 200));

    const getHeader = spy.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/header") &&
        (init?.method || "GET").toUpperCase() === "GET",
    );
    expect(getHeader).toBeUndefined();

    const getContent = spy.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/content") &&
        (init?.method || "GET").toUpperCase() === "GET",
    );
    expect(getContent).toBeDefined();
    const sentRange = new Headers(getContent![1]?.headers).get("range");
    expect(sentRange).toBe("bytes=100-199");
  });

  // Resuming with open-ended range (partial file download with unknown total size)

  test("open-ended Range bytes=N- → 206 from N to end", async () => {
    setSession(validSession);
    installDispatchedFetch(defaultHandler);

    const start = HEADER_LEN + 500;

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${start}-`,
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(
      `bytes ${start}-${TOTAL_LEN - 1}/${TOTAL_LEN}`,
    );

    const body = await readAll(response.body);
    expect(body).toEqual(contentBody.subarray(500));
  });

  // Header-overlapping ranges are refused and the proxy serves the full file
  // instead. This protects against resumes that would splice a fresh
  // re-encrypted header onto a stale one thus resulting in corrupted downloads.

  test("Range spanning header/content boundary → 200 full file", async () => {
    setSession(validSession);
    installDispatchedFetch(defaultHandler);

    const start = HEADER_LEN - 10;
    const end = HEADER_LEN + 9;

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${start}-${end}`,
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(String(TOTAL_LEN));
    expect(response.headers.get("content-range")).toBeNull();
  });

  test("Range starting exactly at headerLen with If-Range → 206, no /header GET", async () => {
    setSession(validSession);
    const spy = installDispatchedFetch(defaultHandler);

    const start = HEADER_LEN;
    const end = HEADER_LEN + 99;

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${start}-${end}`,
      ifRange: EXPOSED_ETAG,
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-length")).toBe("100");
    expect(response.headers.get("content-range")).toBe(
      `bytes ${start}-${end}/${TOTAL_LEN}`,
    );

    const body = await readAll(response.body);
    expect(body).toEqual(contentBody.subarray(0, 100));

    const getHeader = spy.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/header") &&
        (init?.method || "GET").toUpperCase() === "GET",
    );
    expect(getHeader).toBeUndefined();
  });

  // If-Range matching ETag should honor the Range, otherwise ignore it and return 200 with full body.

  test("If-Range matching ETag honors the Range", async () => {
    setSession(validSession);
    installDispatchedFetch(defaultHandler);

    const start = HEADER_LEN + 50;
    const end = HEADER_LEN + 99;

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${start}-${end}`,
      ifRange: EXPOSED_ETAG,
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(
      `bytes ${start}-${end}/${TOTAL_LEN}`,
    );
  });

  test("If-Range mismatching ETag → ignore Range, return 200 full body", async () => {
    setSession(validSession);
    installDispatchedFetch(defaultHandler);

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${HEADER_LEN + 50}-${HEADER_LEN + 99}`,
      ifRange: '"stale-etag"',
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(String(TOTAL_LEN));
    expect(response.headers.get("content-range")).toBeNull();
  });

  // Unsatisfiable range

  test("Range past end of file → 416 with Content-Range total", async () => {
    setSession(validSession);
    installDispatchedFetch(defaultHandler);

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${TOTAL_LEN + 100}-`,
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(416);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-range")).toBe(`bytes */${TOTAL_LEN}`);
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ status: 416 });
  });

  // Upstream errors during HEAD probes

  test.each([
    {
      name: "404 on /header HEAD surfaces problem+json detail",
      failed: "header",
      status: 403,
      body: { title: "Forbidden", status: 403, detail: "No access." },
      expectedDetail: "No access.",
    },
    {
      name: "500 on /content HEAD uses generic fallback",
      failed: "content",
      status: 500,
      body: "boom",
      expectedDetail: "Download failed with status 500.",
    },
  ])("$name", async ({ failed, status, body, expectedDetail }) => {
    setSession(validSession);
    installDispatchedFetch((url, init) => {
      const method = (init?.method || "GET").toUpperCase();

      if (failed === "header" && url.endsWith("/header") && method === "HEAD") {
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
        const contentType =
          typeof body === "string" ? "text/plain" : "application/problem+json";
        return new Response(bodyStr, {
          status,
          headers: { "content-type": contentType },
        });
      }
      if (
        failed === "content" &&
        url.endsWith("/content") &&
        method === "HEAD"
      ) {
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
        const contentType =
          typeof body === "string" ? "text/plain" : "application/problem+json";
        return new Response(bodyStr, {
          status,
          headers: { "content-type": contentType },
        });
      }
      return defaultHandler(url, init);
    });

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: expectedDetail,
      status,
    });
  });

  // Upstream errors during body fetches

  test("403 on /content GET after successful HEADs surfaces problem+json detail", async () => {
    setSession(validSession);
    installDispatchedFetch((url, init) => {
      const method = (init?.method || "GET").toUpperCase();
      if (url.endsWith("/content") && method === "GET") {
        return new Response(
          JSON.stringify({
            title: "Forbidden",
            status: 403,
            detail: "Access revoked mid-stream.",
          }),
          {
            status: 403,
            headers: { "content-type": "application/problem+json" },
          },
        );
      }
      return defaultHandler(url, init);
    });

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "Access revoked mid-stream.",
      status: 403,
    });
  });

  // Network failure

  test("returns 502 when the probe fetch itself fails", async () => {
    setSession(validSession);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "Could not reach the download backend: Network error",
      status: 502,
    });
  });

  // Simulate a session where the user has just uploaded a new key.
  // The browser is replaying the If-Range it captured from the previous
  // download (when a different key was in use).
  test("resume with old key's ETag after key swap → 200 full file", async () => {
    setSession({
      token: "my-token",
      publicKey: { key: "NEW_PUBKEY", pemChecksum: "new-checksum" },
    });
    installDispatchedFetch(defaultHandler);

    const oldExposedEtag = `"content-etag-abc-old-checksum"`;

    const { request, params } = makeRequest("file-1", {
      range: `bytes=${HEADER_LEN + 100}-${HEADER_LEN + 199}`,
      ifRange: oldExposedEtag,
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(String(TOTAL_LEN));
    expect(response.headers.get("content-range")).toBeNull();
    expect(response.headers.get("etag")).toBe(
      `"content-etag-abc-new-checksum"`,
    );
  });
});
