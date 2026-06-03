import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { Config } from "./config";
import {
  extractJWT,
  extractSession,
  extractProfile,
  LsaaiOidcProvider,
  getAuthOptions,
} from "./auth";
import { Account, User } from "next-auth";
import * as fs from "fs";

const completeConfig: Config = {
  sdaBaseUrl: "https://test.local",
  sessionSecretPath: "session-secret-path",
  nextAuthSecretPath: "auth-secret-path",
  nextAuthUrl: "http://localhost:3002",
  oidcClientSecretPath: "client-secret-path",
  oidcClientIdPath: "client-id-path",
  oidcRoot: "http://localhost:3002",
  allowHttp: false,
};

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
    getConfig: async () => completeConfig,
  };
});

vi.mock(import("@/app/lib/session"), () => {
  return {
    createOrUpdateSession: vi.fn(),
  };
});

import { createOrUpdateSession } from "./session";

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

  test("extract JWT information", async () => {
    const token = { token: "The token" };
    vi.mocked(createOrUpdateSession).mockImplementation(() =>
      Promise.resolve(),
    );
    const profile = {
      sub: "sub123",
      email: "email123@local.local",
    };
    const result = await extractJWT({
      user: {} as User,
      token: token,
      profile: profile,
      account: { access_token: accessToken } as Account,
    });
    expect(result).toStrictEqual(token);
    expect(createOrUpdateSession).toHaveBeenCalledWith({
      token: accessToken,
    });
  });

  test("extract Session information", async () => {
    const session = {
      expires: "2026-06-03",
    };
    const result = await extractSession({
      session: session,
      token: {},
      user: { id: "", email: "", emailVerified: null },
      trigger: "update",
      newSession: null,
    });
    expect(result).toStrictEqual(session);
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
    expect(options).toStrictEqual({
      secret: completeConfig.nextAuthSecretPath,
      providers: [
        LsaaiOidcProvider(completeConfig.oidcRoot, {
          clientId: completeConfig.oidcClientIdPath,
          clientSecret: completeConfig.oidcClientSecretPath,
        }),
      ],
      session: { strategy: "jwt" },
      callbacks: {
        jwt: extractJWT,
        session: extractSession,
      },
    });
  });
});
