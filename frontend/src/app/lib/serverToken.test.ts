import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { encode, decode } from "next-auth/jwt";
import {
  clearServerToken,
  getServerToken,
  updateServerToken,
  getSession,
} from "./serverToken";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const SECRET = "test-secret-test-secret-test-secret-test";

// The tests toggle nextAuthUrl to exercise both cookie names.
const configState: { nextAuthUrl: string } = {
  nextAuthUrl: "http://localhost:3002",
};

vi.mock("./config", () => ({
  getConfig: async () => ({ nextAuthUrl: configState.nextAuthUrl }),
}));
vi.mock("./auth", () => ({
  getAuthConfig: () => ({ nextAuthSecret: SECRET }),
}));

function makeStore(initial: Record<string, string> = {}) {
  const jar: Record<string, string> = { ...initial };
  return {
    get: (name: string) =>
      name in jar ? { name, value: jar[name] } : undefined,
    set: vi.fn(
      (name: string, value: string, _opts?: Record<string, unknown>) => {
        jar[name] = value;
      },
    ),
    delete: vi.fn((name: string) => {
      delete jar[name];
    }),
    _jar: jar,
  };
}

const nowSec = () => Math.floor(Date.now() / 1000);

async function encodeCookie(
  token: Record<string, unknown>,
  maxAgeSeconds: number,
) {
  return encode({ token, secret: SECRET, maxAge: maxAgeSeconds });
}

describe("getServerToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configState.nextAuthUrl = "http://localhost:3002";
  });

  it("returns the decrypted JWT when the access token is still valid", async () => {
    const encoded = await encodeCookie(
      { accessToken: "at", expiresAt: nowSec() + 60, publicKey: null },
      300,
    );
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "next-auth.session-token": encoded }) as never,
    );

    const jwt = await getServerToken();
    expect(jwt).toMatchObject({ accessToken: "at", publicKey: null });
  });

  it("returns null when no cookie is present", async () => {
    vi.mocked(cookies).mockResolvedValue(makeStore() as never);
    expect(await getServerToken()).toBeNull();
  });

  it("returns null when the cookie can't be decoded", async () => {
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "next-auth.session-token": "garbage" }) as never,
    );
    expect(await getServerToken()).toBeNull();
  });

  it("returns null when the JWT has expired", async () => {
    const encoded = await encode({
      token: { accessToken: "at", expiresAt: nowSec() - 3600 },
      secret: SECRET,
      maxAge: -3600, // Must exceed next-auth's 15s decode clockTolerance so decode throws.
    });
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "next-auth.session-token": encoded }) as never,
    );
    expect(await getServerToken()).toBeNull();
  });

  it("reads the __Secure- prefixed cookie in production", async () => {
    configState.nextAuthUrl = "https://prod.example.com";
    const encoded = await encodeCookie(
      { accessToken: "prod", expiresAt: nowSec() + 60 },
      300,
    );
    vi.mocked(cookies).mockResolvedValue(
      makeStore({
        // Non-prefixed one is deliberately present but must be ignored in prod.
        "next-auth.session-token": "wrong",
        "__Secure-next-auth.session-token": encoded,
      }) as never,
    );
    expect(await getServerToken()).toMatchObject({ accessToken: "prod" });
  });
});

describe("updateServerToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configState.nextAuthUrl = "http://localhost:3002";
  });

  it("merges the patch and preserves the access-token-derived lifetime", async () => {
    const expiresAt = nowSec() + 3600;
    const encoded = await encodeCookie(
      { accessToken: "at", expiresAt, publicKey: null },
      7200, // deliberately longer than the access token
    );
    const store = makeStore({ "next-auth.session-token": encoded });
    vi.mocked(cookies).mockResolvedValue(store as never);

    await updateServerToken({
      publicKey: { key: "k", pemChecksum: "cs" },
    });

    expect(store.set).toHaveBeenCalledOnce();
    const [name, newCookieValue, opts] = store.set.mock.calls[0];
    expect(name).toBe("next-auth.session-token");

    const decoded = await decode({ token: newCookieValue, secret: SECRET });
    expect(decoded).toMatchObject({
      accessToken: "at",
      expiresAt,
      publicKey: { key: "k", pemChecksum: "cs" },
    });

    // maxAge should track the access token's remaining lifetime, not the
    // 7200 the cookie was originally written with, and not a fresh 30d.
    const remaining = opts?.maxAge as number;
    expect(remaining).toBeGreaterThan(3500);
    expect(remaining).toBeLessThanOrEqual(3600);
  });

  it("writes the __Secure- prefixed cookie in production", async () => {
    configState.nextAuthUrl = "https://prod.example.com";
    const encoded = await encodeCookie(
      { accessToken: "at", expiresAt: nowSec() + 60 },
      300,
    );
    const store = makeStore({ "__Secure-next-auth.session-token": encoded });
    vi.mocked(cookies).mockResolvedValue(store as never);

    await updateServerToken({ publicKey: null });

    const [name, , opts] = store.set.mock.calls[0];
    expect(name).toBe("__Secure-next-auth.session-token");
    expect(opts?.secure).toBe(true);
  });

  it("does not create a cookie when none exists", async () => {
    const store = makeStore();
    vi.mocked(cookies).mockResolvedValue(store as never);
    await updateServerToken({ publicKey: null });
    expect(store.set).not.toHaveBeenCalled();
  });

  it("does not write when the session has already expired", async () => {
    const encoded = await encodeCookie(
      { accessToken: "at", expiresAt: nowSec() - 1 },
      300,
    );
    const store = makeStore({ "next-auth.session-token": encoded });
    vi.mocked(cookies).mockResolvedValue(store as never);

    await updateServerToken({ publicKey: null });
    expect(store.set).not.toHaveBeenCalled();
  });

  it("does not write when the JWT has no expiresAt", async () => {
    // Simulate a pre-migration cookie: no expiresAt field.
    const encoded = await encodeCookie({ accessToken: "at" }, 300);
    const store = makeStore({ "next-auth.session-token": encoded });
    vi.mocked(cookies).mockResolvedValue(store as never);

    await updateServerToken({ publicKey: null });
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe("clearServerToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configState.nextAuthUrl = "http://localhost:3002";
  });

  it("deletes the cookie when present", async () => {
    const store = makeStore({ "next-auth.session-token": "x" });
    vi.mocked(cookies).mockResolvedValue(store as never);
    await clearServerToken();
    expect(store.delete).toHaveBeenCalledWith("next-auth.session-token");
  });

  it("uses the __Secure- prefixed name in production", async () => {
    configState.nextAuthUrl = "https://prod.example.com";
    const store = makeStore({ "__Secure-next-auth.session-token": "y" });
    vi.mocked(cookies).mockResolvedValue(store as never);
    await clearServerToken();
    expect(store.delete).toHaveBeenCalledWith(
      "__Secure-next-auth.session-token",
    );
  });

  it("does nothing when no cookie is present", async () => {
    const store = makeStore();
    vi.mocked(cookies).mockResolvedValue(store as never);
    await clearServerToken();
    expect(store.delete).not.toHaveBeenCalled();
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configState.nextAuthUrl = "http://localhost:3002";
  });

  it("projects the JWT to the SessionData shape when signed in", async () => {
    const encoded = await encodeCookie(
      {
        accessToken: "at",
        expiresAt: nowSec() + 60,
        publicKey: { key: "k", pemChecksum: "cs" },
      },
      300,
    );
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "next-auth.session-token": encoded }) as never,
    );

    await expect(getSession()).resolves.toEqual({
      token: "at",
      publicKey: { key: "k", pemChecksum: "cs" },
    });
  });

  it("hides refreshToken and expiresAt from the projected shape", async () => {
    const encoded = await encodeCookie(
      {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: nowSec() + 60,
        publicKey: null,
      },
      300,
    );
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "next-auth.session-token": encoded }) as never,
    );

    const session = await getSession();
    expect(session).toEqual({ token: "at", publicKey: null });
    expect(session).not.toHaveProperty("refreshToken");
    expect(session).not.toHaveProperty("expiresAt");
  });

  it("returns null when there is no session cookie", async () => {
    vi.mocked(cookies).mockResolvedValue(makeStore() as never);
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null when the JWT has no accessToken", async () => {
    // A malformed / partially-populated JWT should not present as a signed-in
    // session to callers.
    const encoded = await encodeCookie({ expiresAt: nowSec() + 60 }, 300);
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "next-auth.session-token": encoded }) as never,
    );
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null when the JWT has expired", async () => {
    const encoded = await encode({
      token: { accessToken: "at", expiresAt: nowSec() - 3600 },
      secret: SECRET,
      // Must exceed next-auth's 15s decode clockTolerance so decode throws.
      maxAge: -3600,
    });
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "next-auth.session-token": encoded }) as never,
    );
    await expect(getSession()).resolves.toBeNull();
  });
});
