import { beforeEach, describe, expect, test, vi } from "vitest";
import * as jose from "jose";
import { testConfig } from "@/test/testConfig";

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/config", () => ({ getConfig: async () => testConfig }));
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();

  return {
    ...actual,
    createRemoteJWKSet: vi.fn(),
    jwtVerify: vi.fn(),
  };
});

const discovery = {
  issuer: `${testConfig.oidcRoot}/`,
  jwks_uri: `${testConfig.oidcRoot}/jwk`,
};

describe("verifyAccessToken", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("verifies against JWKS on the happy path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => discovery,
      }),
    );

    const jwks = vi.fn();

    vi.mocked(jose.createRemoteJWKSet).mockReturnValue(jwks as never);

    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: {
        sub: "test-user",
        exp: 1234567890,
      },
      protectedHeader: {
        alg: "RS256",
      },
    } as never);

    const { verifyAccessToken } = await import("./oidc");
    const result = await verifyAccessToken("access-token");

    expect(fetch).toHaveBeenCalledWith(
      `${testConfig.oidcRoot}/.well-known/openid-configuration`,
    );

    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(
      new URL(discovery.jwks_uri),
    );

    expect(jose.jwtVerify).toHaveBeenCalledWith("access-token", jwks, {
      issuer: discovery.issuer,
    });
    expect(result).toEqual({
      sub: "test-user",
      exp: 1234567890,
    });
  });

  test("throws if OIDC discovery request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    const { verifyAccessToken } = await import("./oidc");
    await expect(verifyAccessToken("access-token")).rejects.toThrow(
      "Failed to fetch OIDC discovery document.",
    );
  });

  test("caches issuer + JWKS across calls", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => discovery,
    });
    vi.stubGlobal("fetch", fetchSpy);
    const jwks = vi.fn();

    vi.mocked(jose.createRemoteJWKSet).mockReturnValue(jwks as never);
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: {},
      protectedHeader: { alg: "RS256" },
    } as never);

    const { verifyAccessToken } = await import("./oidc");
    await verifyAccessToken("at");
    await verifyAccessToken("at");

    // Discovery is fetched once, not twice.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1);
  });
});

describe("getEndSessionEndpoint", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("returns the URL when the OP advertises one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...discovery,
          end_session_endpoint: `${testConfig.oidcRoot}/logout`,
        }),
      }),
    );
    vi.mocked(jose.createRemoteJWKSet).mockReturnValue(vi.fn() as never);

    const { getEndSessionEndpoint } = await import("./oidc");
    await expect(getEndSessionEndpoint()).resolves.toBe(
      `${testConfig.oidcRoot}/logout`,
    );
  });

  test("returns null when the OP does not advertise one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => discovery, // no end_session_endpoint
      }),
    );
    vi.mocked(jose.createRemoteJWKSet).mockReturnValue(vi.fn() as never);

    const { getEndSessionEndpoint } = await import("./oidc");
    await expect(getEndSessionEndpoint()).resolves.toBeNull();
  });

  test("shares the discovery cache with verifyAccessToken", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...discovery,
        end_session_endpoint: `${testConfig.oidcRoot}/logout`,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    vi.mocked(jose.createRemoteJWKSet).mockReturnValue(vi.fn() as never);
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: {},
      protectedHeader: { alg: "RS256" },
    } as never);

    const { verifyAccessToken, getEndSessionEndpoint } = await import("./oidc");
    await verifyAccessToken("at");
    await getEndSessionEndpoint();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
