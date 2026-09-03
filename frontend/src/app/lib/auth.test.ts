import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import {
  extractJWT,
  extractSession,
  extractProfile,
  LsaaiOidcProvider,
  getAuthOptions,
} from "./auth";
import { Account, User } from "next-auth";
import { decode as defaultDecode } from "next-auth/jwt";
import * as fs from "fs";
import { testConfig } from "@/test/testConfig";
import { verifyAccessToken } from "./oidc";

const accessToken: string = "access_token";

vi.mock("fs");

vi.mock(import("next/server"), () => {
  return {
    connection: async () => {},
  };
});

vi.mock(import("next/server"), () => {
  return {
    connection: async () => {},
  };
});

vi.mock(import("server-only"), () => {
  return {};
});

vi.mock(import("@/app/lib/config"), () => {
  return {
    getConfig: async () => testConfig,
  };
});

vi.mock("./oidc", () => ({
  verifyAccessToken: vi.fn(),
}));

describe("auth oidc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("get LsaaiOidcProvider", async () => {
    const root = "http://root";
    const clientId = "clientId";
    const clientSecret = "clientSecret";
    const result = LsaaiOidcProvider(root, {
      clientId,
      clientSecret,
    });
    expect(result).toStrictEqual({
      id: "lsaai-oidc",
      name: "LSAAI",
      type: "oauth",
      wellKnown: `${root}/.well-known/openid-configuration`,
      authorization: {
        params: {
          scope: "openid profile email ga4gh_passport_v1 eduperson_entitlement",
        },
      },
      idToken: true,
      checks: ["pkce", "state", "nonce"],
      profile: extractProfile,
      clientId,
      clientSecret,
    });
  });

  test("extractJWT verifies the access token and copies fields", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({} as never);

    const account = {
      access_token: "at",
      refresh_token: "rt",
      expires_at: 1_700_000_000,
    } as Account;
    const profile = { sub: "u1", email: "u1@example.com" };

    const result = await extractJWT({
      token: {},
      account,
      profile,
      user: {} as User,
    });

    expect(verifyAccessToken).toHaveBeenCalledWith("at");
    expect(result).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 1_700_000_000,
      publicKey: null,
    });
  });

  test("extractJWT does not populate the token when verification fails", async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(new Error("bad signature"));

    const account = { access_token: "at" } as Account;
    const profile = { sub: "u1", email: "u1@example.com" };

    await expect(
      extractJWT({ token: {}, account, profile, user: {} as User }),
    ).rejects.toThrow("bad signature");
  });

  test("extractSession exposes expires + pemChecksum but not tokens", async () => {
    const result = await extractSession({
      session: { expires: "ignored" },
      token: {
        accessToken: "SECRET",
        refreshToken: "ALSO_SECRET",
        expiresAt: 1_700_000_000,
        publicKey: { key: "k", pemChecksum: "abc" },
      },
      user: { id: "", email: "", emailVerified: null },
      trigger: "update",
      newSession: null,
    });

    expect(result).not.toHaveProperty("accessToken");
    expect(result).not.toHaveProperty("refreshToken");
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(result).toMatchObject({
      expires: new Date(1_700_000_000 * 1000).toISOString(),
      pemChecksum: "abc",
    });
  });

  test("extract Profile information", async () => {
    const result = await extractProfile({ sub: "sub123" }, {});
    expect(result).toStrictEqual({
      id: "sub123",
    });
  });

  test("auth config is cached", async () => {
    /* Using dynamic import in order to avoid issues with cached config values */
    const { getAuthConfig } = await import("./auth");
    const config = {
      nextAuthSecretPath: "nextAuthSecretPath",
      oidcClientSecretPath: "oidcClientSecretPath",
      oidcClientIdPath: "oidcClientIdPath",
    };
    vi.spyOn(fs, "readFileSync").mockImplementation((path) => String(path));
    const authConfig = await getAuthConfig(config);
    expect(authConfig).toStrictEqual({
      nextAuthSecret: "nextAuthSecretPath",
      oidcClientSecret: "oidcClientSecretPath",
      oidcClientId: "oidcClientIdPath",
    });
    await getAuthConfig(config);
    expect(fs.readFileSync).toHaveBeenCalledTimes(3);
  });

  test("get auth options", async () => {
    const options = await getAuthOptions();
    vi.spyOn(fs, "readFileSync").mockImplementation((path) => String(path));
    expect(options).toMatchObject({
      secret: testConfig.nextAuthSecretPath,
      providers: [
        LsaaiOidcProvider(testConfig.oidcRoot, {
          clientId: testConfig.oidcClientIdPath,
          clientSecret: testConfig.oidcClientSecretPath,
        }),
      ],
      session: { strategy: "jwt" },
      pages: { signIn: "/login" },
      callbacks: {
        jwt: extractJWT,
        session: extractSession,
      },
    });
    expect(options.jwt?.encode).toBeInstanceOf(Function);
    expect(options.jwt?.decode).toBe(defaultDecode);
  });

  test("jwt.encode derives maxAge from token.expiresAt", async () => {
    const options = await getAuthOptions();
    const encodeSpy = vi
      .spyOn(await import("next-auth/jwt"), "encode")
      .mockResolvedValue("stub");

    const nowSec = Math.floor(Date.now() / 1000);
    await options.jwt!.encode!({
      token: { accessToken: "at", expiresAt: nowSec + 600 },
      secret: "s",
      maxAge: 999, // should be ignored
    });

    const call = encodeSpy.mock.calls.at(-1)![0];
    expect(call.maxAge).toBeGreaterThan(500);
    expect(call.maxAge).toBeLessThanOrEqual(600);
  });
});
