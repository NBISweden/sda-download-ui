import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import {
  isFromLogoutCompleteFlow,
  isSignedOut,
  markLogoutComplete,
} from "./logoutFlow";
import { getServerToken } from "./serverToken";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("./serverToken", () => ({ getServerToken: vi.fn() }));

const configState: { nextAuthUrl: string } = {
  nextAuthUrl: "http://localhost:3002",
};

vi.mock("./config", () => ({
  getConfig: async () => ({ nextAuthUrl: configState.nextAuthUrl }),
}));

type CookieSetOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: number;
};

function makeStore(initial: Record<string, string> = {}) {
  const jar: Record<string, string> = { ...initial };
  return {
    get: (name: string) =>
      name in jar ? { name, value: jar[name] } : undefined,
    has: (name: string) => name in jar,
    set: vi.fn((name: string, value: string, opts?: CookieSetOptions) => {
      jar[name] = value;
    }),
  };
}

describe("isSignedOut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when there is no session token", async () => {
    vi.mocked(getServerToken).mockResolvedValue(null);
    await expect(isSignedOut()).resolves.toBe(true);
  });

  it("returns false when a session token is present", async () => {
    vi.mocked(getServerToken).mockResolvedValue({ accessToken: "at" } as never);
    await expect(isSignedOut()).resolves.toBe(false);
  });
});

describe("markLogoutComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configState.nextAuthUrl = "http://localhost:3002";
  });

  it("sets an httpOnly, sameSite=lax, path=/ cookie with a short TTL", async () => {
    const store = makeStore();
    vi.mocked(cookies).mockResolvedValue(store as never);

    await markLogoutComplete();

    expect(store.set).toHaveBeenCalledOnce();
    const [name, value, opts] = store.set.mock.calls[0];
    expect(name).toBe("sdad-logout-complete");
    expect(value).toBe("1");
    expect(opts).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    // Short TTL: long enough for the round-trip, short enough that a stale
    // flag doesn't linger.
    expect(opts?.maxAge).toBeGreaterThan(0);
    expect(opts?.maxAge).toBeLessThanOrEqual(5 * 60);
  });

  it("sets secure=false when nextAuthUrl is http", async () => {
    const store = makeStore();
    vi.mocked(cookies).mockResolvedValue(store as never);

    await markLogoutComplete();

    const [, , opts] = store.set.mock.calls[0];
    expect(opts?.secure).toBe(false);
  });

  it("sets secure=true when nextAuthUrl is https", async () => {
    configState.nextAuthUrl = "https://prod.example.com";
    const store = makeStore();
    vi.mocked(cookies).mockResolvedValue(store as never);

    await markLogoutComplete();

    const [, , opts] = store.set.mock.calls[0];
    expect(opts?.secure).toBe(true);
  });
});

describe("isFromLogoutCompleteFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when the marker cookie is present", async () => {
    vi.mocked(cookies).mockResolvedValue(
      makeStore({ "sdad-logout-complete": "1" }) as never,
    );
    await expect(isFromLogoutCompleteFlow()).resolves.toBe(true);
  });

  it("returns false when the marker cookie is absent", async () => {
    vi.mocked(cookies).mockResolvedValue(makeStore() as never);
    await expect(isFromLogoutCompleteFlow()).resolves.toBe(false);
  });
});
