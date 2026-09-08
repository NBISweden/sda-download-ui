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

const completeConfig: Omit<Config, "allowHttp"> = {
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
    expect(result).toStrictEqual({ ...completeConfig, allowHttp: false });
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
});
