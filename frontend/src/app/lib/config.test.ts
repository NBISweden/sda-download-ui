import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { Config, parseConfig } from "./config";

vi.mock(import("next/server"), () => {
  return {
    connection: async () => {},
  };
});

vi.mock(import("server-only"), () => {
  return {};
});

const completeConfig: Omit<Config, "allowHttp" | "oidcExtraScopes"> = {
  sdaBaseUrl: "https://test.local",
  nextAuthSecretPath: "/auth-secret",
  nextAuthUrl: "http://localhost:3002",
  oidcClientSecretPath: "/client-secret",
  oidcClientIdPath: "/client-id",
  oidcRoot: "http://localhost:3002",
};

describe("config loading functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("parse config string to config object", () => {
    const result = parseConfig(JSON.stringify(completeConfig));
    expect(result).toStrictEqual({
      ...completeConfig,
      allowHttp: false,
      oidcExtraScopes: [],
    });
  });

  test("parse config accepts an explicit oidcExtraScopes list", () => {
    const result = parseConfig(
      JSON.stringify({
        ...completeConfig,
        oidcExtraScopes: ["ga4gh_passport_v1"],
      }),
    );
    expect(result.oidcExtraScopes).toEqual(["ga4gh_passport_v1"]);
  });

  test("parse config defaults oidcExtraScopes to an empty array", () => {
    const result = parseConfig(JSON.stringify(completeConfig));
    expect(result.oidcExtraScopes).toEqual([]);
  });

  test("parse config rejects a scope containing a space", () => {
    expect(() =>
      parseConfig(
        JSON.stringify({
          ...completeConfig,
          oidcExtraScopes: ["not valid"],
        }),
      ),
    ).toThrow();
  });

  test("parse config rejects a non-string scope", () => {
    expect(() =>
      parseConfig(
        JSON.stringify({
          ...completeConfig,
          oidcExtraScopes: [123],
        }),
      ),
    ).toThrow();
  });

  test("fail to parse config string when missing options", () => {
    const configWithMissingData: Partial<Config> = { ...completeConfig };
    delete configWithMissingData.nextAuthSecretPath;
    expect(() => parseConfig(JSON.stringify(configWithMissingData))).toThrow();
  });

  test("fail to parse config string when including extra options", () => {
    expect(() => {
      const configWithExtra = {
        ...completeConfig,
        extra: "yes",
      };
      parseConfig(JSON.stringify(configWithExtra));
    }).toThrow();
  });

  test("parse config accepts an optional postLogoutRedirectUri", () => {
    const result = parseConfig(
      JSON.stringify({
        ...completeConfig,
        postLogoutRedirectUri: "https://app.example.com/",
      }),
    );
    expect(result.postLogoutRedirectUri).toBe("https://app.example.com/");
  });

  test("parse config rejects a malformed postLogoutRedirectUri", () => {
    expect(() =>
      parseConfig(
        JSON.stringify({
          ...completeConfig,
          postLogoutRedirectUri: "not a url",
        }),
      ),
    ).toThrow();
  });
});
