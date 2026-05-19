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

  test("returns 400 when session has no public key", async () => {
    setSession({ token: "my-token", publicKey: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      status: 400,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("calls upstream with Authorization, X-C4GH-Public-Key and forwards Range/If-Range", async () => {
    setSession(validSession);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("payload", {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": 'attachment; filename="upstream.c4gh"',
        },
      }),
    );

    const { request, params } = makeRequest("file-1", {
      range: "bytes=0-1048575",
      ifRange: '"etag-value"',
    });
    await GET(request, { params });

    expect(fetchSpy).toHaveBeenCalledWith(`${sdaBaseUrl}/files/file-1`, {
      headers: {
        Authorization: "Bearer my-token",
        "X-C4GH-Public-Key": "PUBKEY",
        Range: "bytes=0-1048575",
        "If-Range": '"etag-value"',
      },
      cache: "no-store",
    });
  });

  test("forwards documented response headers and streams body on success", async () => {
    setSession(validSession);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("payload", {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-length": "7",
          "content-disposition": 'attachment; filename="upstream.c4gh"',
          "accept-ranges": "bytes",
          etag: '"abc123"',
          "last-modified": "Wed, 01 Jan 2025 00:00:00 GMT",
        },
      }),
    );

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("content-length")).toBe("7");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="upstream.c4gh"',
    );
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("etag")).toBe('"abc123"');
    expect(response.headers.get("last-modified")).toBe(
      "Wed, 01 Jan 2025 00:00:00 GMT",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("payload");
  });

  test("fallback Content-Disposition uses basename from name query param", async () => {
    setSession(validSession);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("payload", {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );

    const { request, params } = makeRequest("file-1", {
      name: "samples/controls/sample1.cram.c4gh",
    });
    const response = await GET(request, { params });

    expect(response.headers.get("content-disposition")).toBe(
      "attachment; " +
        'filename="sample1.cram.c4gh"; ' +
        "filename*=UTF-8''sample1.cram.c4gh",
    );
  });

  test("fallback Content-Disposition uses <fileId>.c4gh when no name is given", async () => {
    setSession(validSession);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("payload", {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.headers.get("content-disposition")).toBe(
      "attachment; " +
        'filename="file-1.c4gh"; ' +
        "filename*=UTF-8''file-1.c4gh",
    );
  });

  test.each([
    {
      name: "401 from upstream surfaces detail from problem+json",
      status: 401,
      body: { title: "Unauthorized", status: 401, detail: "Token expired." },
      expectedDetail: "Token expired.",
    },
    {
      name: "403 from upstream surfaces detail from problem+json",
      status: 403,
      body: {
        title: "Forbidden",
        status: 403,
        detail: "You do not have access.",
      },
      expectedDetail: "You do not have access.",
    },
    {
      name: "416 from upstream surfaces detail from problem+json",
      status: 416,
      body: {
        title: "Range Not Satisfiable",
        status: 416,
        detail: "Out of range.",
      },
      expectedDetail: "Out of range.",
    },
    {
      name: "500 from upstream surfaces detail from problem+json",
      status: 500,
      body: { title: "Internal Server Error", status: 500, detail: "Boom." },
      expectedDetail: "Boom.",
    },
  ])("$name", async ({ status, body, expectedDetail }) => {
    setSession(validSession);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/problem+json" },
      }),
    );

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

  test.each([
    {
      name: "401 with non-JSON body uses 401 fallback message",
      status: 401,
      body: "not json",
      expected:
        "Authentication with the download backend failed. Please sign in again.",
    },
    {
      name: "403 with non-JSON body uses 403 fallback message",
      status: 403,
      body: "not json",
      expected: "You do not have access to this file (or it does not exist).",
    },
    {
      name: "416 with non-JSON body uses 416 fallback message",
      status: 416,
      body: "not json",
      expected: "The requested byte range is not satisfiable.",
    },
    {
      name: "500 with non-JSON body uses generic fallback message",
      status: 500,
      body: "not json",
      expected: "Download failed with status 500.",
    },
  ])("$name", async ({ status, body, expected }) => {
    setSession(validSession);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, {
        status,
        headers: { "content-type": "text/plain" },
      }),
    );

    const { request, params } = makeRequest("file-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: expected,
      status,
    });
  });

  test("returns 502 when fetch itself fails", async () => {
    setSession(validSession);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network error"),
    );

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
});