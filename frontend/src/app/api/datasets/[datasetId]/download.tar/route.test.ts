import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import type { SessionData } from "@/app/lib/SessionManager";

const sdaBaseUrl = "http://test.local";

vi.mock(import("next/server"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, connection: async () => {} };
});
vi.mock(import("server-only"), () => ({}));
vi.mock(import("@/app/lib/config"), () => ({
  getConfig: async () => ({ sdaBaseUrl, sessionSecretPath: "" }),
}));

const sessionState: { current: SessionData | null } = { current: null };
vi.mock(import("@/app/lib/session"), () => ({
  getSession: async () => sessionState.current,
  createOrUpdateSession: async () => undefined,
  getClaims: async () => ({}),
}));

type MockFile = {
  fileId: string;
  filePath: string;
  size: number;
  decryptedSize: number;
  checksums: never[];
  downloadUrl: string;
};

const datasetState: {
  metadata: { datasetId: string; date: string; files: number; size: number };
  files: MockFile[];
  metadataError: Error | null;
  filesError: Error | null;
} = {
  metadata: {
    datasetId: "ds1",
    date: "2024-01-01T00:00:00Z",
    files: 2,
    size: 30,
  },
  files: [],
  metadataError: null,
  filesError: null,
};

vi.mock(import("@/app/actions/datasets"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchDatasetMetadata: async () => {
      if (datasetState.metadataError) throw datasetState.metadataError;
      return datasetState.metadata;
    },
    fetchDatasetFiles: async () => {
      if (datasetState.filesError) throw datasetState.filesError;
      return { files: datasetState.files, nextPageToken: null };
    },
  };
});

const validSession: SessionData = {
  token: "tok",
  publicKey: { key: "PUBKEY", pemChecksum: "pem123" },
};

const F1: MockFile = {
  fileId: "f1",
  filePath: "a/sample1.cram.c4gh",
  size: 10,
  decryptedSize: 5,
  checksums: [],
  downloadUrl: "",
};
const F2: MockFile = {
  fileId: "f2",
  filePath: "b/sample2.cram.c4gh",
  size: 20,
  decryptedSize: 10,
  checksums: [],
  downloadUrl: "",
};

const F1_HEADER = new Uint8Array([1, 2, 3, 4]);
const F1_CONTENT = new Uint8Array(10).map((_, i) => 10 + i);
const F2_HEADER = new Uint8Array([5, 6, 7, 8, 9]);
const F2_CONTENT = new Uint8Array(20).map((_, i) => 50 + i);

// Per file the layout is: ustar(512) + c4ghHeader + content + pad → 1024 each.
// Two files + 1024-byte trailer = 3072.
const TRAILER_START = 2048;
const TOTAL = 3072;

function installDefaultFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const method = (init?.method || "GET").toUpperCase();

    if (url.endsWith("/files/f1/header") && method === "GET")
      return Promise.resolve(
        new Response(F1_HEADER, {
          status: 200,
          headers: { "content-length": String(F1_HEADER.length) },
        }),
      );
    if (url.endsWith("/files/f2/header") && method === "GET")
      return Promise.resolve(
        new Response(F2_HEADER, {
          status: 200,
          headers: { "content-length": String(F2_HEADER.length) },
        }),
      );
    if (url.endsWith("/files/f1/content") && method === "HEAD")
      return Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { "content-length": String(F1_CONTENT.length) },
        }),
      );
    if (url.endsWith("/files/f2/content") && method === "HEAD")
      return Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { "content-length": String(F2_CONTENT.length) },
        }),
      );
    if (url.endsWith("/files/f1/content") && method === "GET")
      return Promise.resolve(new Response(F1_CONTENT, { status: 200 }));
    if (url.endsWith("/files/f2/content") && method === "GET")
      return Promise.resolve(new Response(F2_CONTENT, { status: 200 }));

    return Promise.resolve(new Response("unmocked " + url, { status: 500 }));
  });
}

function makeReq(opts: { fileIds?: string } = {}) {
  const url = new URL("http://localhost/api/datasets/ds1/download.tar");
  if (opts.fileIds !== undefined) url.searchParams.set("fileIds", opts.fileIds);
  return {
    req: new NextRequest(url),
    params: Promise.resolve({ datasetId: "ds1" }),
  };
}

async function readAll(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((a, c) => a + c.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

function readOctal(buf: Uint8Array, offset: number, len: number): number {
  let end = offset + len;
  for (let i = offset; i < offset + len; i++) {
    if (buf[i] === 0 || buf[i] === 0x20) {
      end = i;
      break;
    }
  }
  return parseInt(
    new TextDecoder().decode(buf.subarray(offset, end)) || "0",
    8,
  );
}

describe("GET /api/datasets/[datasetId]/download.tar (step 1: no resume)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionState.current = null;
    datasetState.metadataError = null;
    datasetState.filesError = null;
    datasetState.files = [F1, F2];
  });
  afterEach(() => vi.restoreAllMocks());

  // --- Auth / input validation (no upstream fetch happens) ---

  test("401 when no session", async () => {
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    expect(resp.status).toBe(401);
    expect(resp.headers.get("cache-control")).toBe("no-store");
    await expect(resp.json()).resolves.toMatchObject({ status: 401 });
  });

  test("400 when session has no public key", async () => {
    sessionState.current = { token: "tok", publicKey: null };
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toMatchObject({ status: 400 });
  });

  test("400 when fileIds query parameter is empty / whitespace-only", async () => {
    sessionState.current = validSession;
    const { req, params } = makeReq({ fileIds: " , ," });
    const resp = await GET(req, { params });
    expect(resp.status).toBe(400);
  });

  test("400 when fileIds exceeds the per-request maximum", async () => {
    sessionState.current = validSession;
    const ids = Array.from({ length: 1001 }, (_, i) => `f${i}`).join(",");
    const { req, params } = makeReq({ fileIds: ids });
    const resp = await GET(req, { params });
    expect(resp.status).toBe(400);
  });

  test("400 when fileIds selection matches no files in dataset", async () => {
    sessionState.current = validSession;
    const { req, params } = makeReq({ fileIds: "does-not-exist" });
    const resp = await GET(req, { params });
    expect(resp.status).toBe(400);
  });

  test("400 when dataset has no files", async () => {
    sessionState.current = validSession;
    datasetState.files = [];
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    expect(resp.status).toBe(400);
  });

  // --- Pre-stream upstream failures translate cleanly ---

  test("502 when dataset metadata fetch fails before streaming starts", async () => {
    sessionState.current = validSession;
    datasetState.metadataError = new Error("backend down");
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    expect(resp.status).toBe(502);
    await expect(resp.json()).resolves.toMatchObject({
      error: expect.stringContaining("backend down"),
      status: 502,
    });
  });

  test("502 when dataset files fetch fails before streaming starts", async () => {
    sessionState.current = validSession;
    datasetState.filesError = new Error("files unavailable");
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    expect(resp.status).toBe(502);
    await expect(resp.json()).resolves.toMatchObject({ status: 502 });
  });

  // --- Happy path: full archive layout ---

  test("returns 200 with the right response headers", async () => {
    sessionState.current = validSession;
    installDefaultFetch();
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    expect(resp.status).toBe(200);
    expect(resp.headers.get("content-type")).toBe("application/x-tar");
    expect(resp.headers.get("cache-control")).toBe("no-store");
    expect(resp.headers.get("content-disposition")).toContain(
      'filename="ds1.tar"',
    );
  });

  test("streams a deterministic full archive with c4gh header + content at known offsets", async () => {
    sessionState.current = validSession;
    installDefaultFetch();
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    const body = await readAll(resp.body);

    expect(body.byteLength).toBe(TOTAL);

    // f1: ustar(0..512) | c4ghHeader(512..516) | content(516..526) | pad(526..1024)
    expect(body.subarray(512, 516)).toEqual(F1_HEADER);
    expect(body.subarray(516, 526)).toEqual(F1_CONTENT);
    expect(body[526]).toBe(0);
    expect(body[1023]).toBe(0);

    // f2: ustar(1024..1536) | c4ghHeader(1536..1541) | content(1541..1561) | pad(1561..2048)
    expect(body.subarray(1536, 1541)).toEqual(F2_HEADER);
    expect(body.subarray(1541, 1561)).toEqual(F2_CONTENT);

    // trailer: 1024 zero bytes
    expect(body.subarray(TRAILER_START)).toEqual(new Uint8Array(1024));
  });

  test("ustar headers carry the correct file path and combined (header+content) size", async () => {
    sessionState.current = validSession;
    installDefaultFetch();
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    const body = await readAll(resp.body);

    const f1Name = new TextDecoder().decode(body.subarray(0, F1.filePath.length));
    expect(f1Name).toBe(F1.filePath);
    expect(readOctal(body, 124, 12)).toBe(F1_HEADER.length + F1_CONTENT.length);

    const f2Name = new TextDecoder().decode(
      body.subarray(1024, 1024 + F2.filePath.length),
    );
    expect(f2Name).toBe(F2.filePath);
    expect(readOctal(body, 1024 + 124, 12)).toBe(
      F2_HEADER.length + F2_CONTENT.length,
    );
  });

  test("ustar mtime is derived from dataset.date", async () => {
    sessionState.current = validSession;
    installDefaultFetch();
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    const body = await readAll(resp.body);
    const expectedMtime = Math.floor(
      new Date(datasetState.metadata.date).getTime() / 1000,
    );
    expect(readOctal(body, 136, 12)).toBe(expectedMtime);
    expect(readOctal(body, 1024 + 136, 12)).toBe(expectedMtime);
  });

  // --- Determinism & selection ---

  test("entries are emitted in alphabetical order by filePath regardless of upstream order", async () => {
    sessionState.current = validSession;
    datasetState.files = [F2, F1]; // reversed in mock
    installDefaultFetch();
    const { req, params } = makeReq();
    const resp = await GET(req, { params });
    const body = await readAll(resp.body);

    // f1 ("a/...") must precede f2 ("b/...") in the emitted archive.
    expect(body.subarray(512, 516)).toEqual(F1_HEADER);
    expect(body.subarray(1536, 1541)).toEqual(F2_HEADER);
  });

  test("repeated invocations produce byte-identical archives", async () => {
    sessionState.current = validSession;
    installDefaultFetch();
    const first = await readAll(
      (await GET(makeReq().req, { params: makeReq().params })).body,
    );
    const second = await readAll(
      (await GET(makeReq().req, { params: makeReq().params })).body,
    );
    expect(first).toEqual(second);
  });

  test("fileIds selection filters the archive to a single entry", async () => {
    sessionState.current = validSession;
    installDefaultFetch();
    const { req, params } = makeReq({ fileIds: "f2" });
    const resp = await GET(req, { params });
    expect(resp.status).toBe(200);

    const body = await readAll(resp.body);
    // single entry (1024) + trailer (1024) = 2048
    expect(body.byteLength).toBe(2048);
    expect(body.subarray(512, 517)).toEqual(F2_HEADER);
    expect(body.subarray(517, 537)).toEqual(F2_CONTENT);
  });

  // --- Outgoing request shape ---

  test("sends the recipient public key only on /header requests", async () => {
    sessionState.current = validSession;
    const spy = installDefaultFetch();
    const { req, params } = makeReq();
    await readAll((await GET(req, { params })).body);

    const calls = spy.mock.calls.map(([input, init]) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      return {
        url,
        method: (init?.method || "GET").toUpperCase(),
        headers: new Headers(init?.headers),
      };
    });

    const headerCalls = calls.filter((c) => c.url.endsWith("/header"));
    expect(headerCalls.length).toBeGreaterThan(0);
    for (const c of headerCalls) {
      expect(c.headers.get("authorization")).toBe("Bearer tok");
      expect(c.headers.get("x-c4gh-public-key")).toBe("PUBKEY");
    }

    const contentCalls = calls.filter((c) => c.url.endsWith("/content"));
    expect(contentCalls.length).toBeGreaterThan(0);
    for (const c of contentCalls) {
      expect(c.headers.get("authorization")).toBe("Bearer tok");
      expect(c.headers.get("x-c4gh-public-key")).toBeNull();
    }
  });
});
