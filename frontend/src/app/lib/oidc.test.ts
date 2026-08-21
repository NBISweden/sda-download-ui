import { beforeEach, describe, expect, test, vi } from "vitest";
import * as jose from "jose";
import { testConfig } from "@/test/testConfig";
import { verifyAccessToken } from "./oidc";

vi.mock(import("server-only"), () => {
  return {};
});

vi.mock(import("@/app/lib/config"), () => {
  return {
    getConfig: async () => testConfig,
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("verifies access token using OIDC discovery and JWKS", async () => {
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

    await expect(verifyAccessToken("access-token")).rejects.toThrow(
      "Failed to fetch OIDC discovery document.",
    );
  });

  test("throws if access token verification fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => discovery,
      }),
    );

    const jwks = vi.fn();

    vi.mocked(jose.createRemoteJWKSet).mockReturnValue(jwks as never);

    vi.mocked(jose.jwtVerify).mockRejectedValue(
      new Error("signature verification failed"),
    );

    await expect(verifyAccessToken("invalid-token")).rejects.toThrow(
      "signature verification failed",
    );
  });
});
