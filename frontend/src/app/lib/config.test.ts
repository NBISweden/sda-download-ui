import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { parseConfig } from "./config";

vi.mock(import("next/server"), () => {
  return {
    connection: async () => {},
  };
});

vi.mock(import("server-only"), () => {
  return {};
});

describe("config loading functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("parse config string to config object", () => {
    const result = parseConfig(
      '{"sdaBaseUrl": "https://test.local", "sessionSecretPath": "/secrets"}',
    );
    expect(result).toStrictEqual({
      sdaBaseUrl: "https://test.local",
      sessionSecretPath: "/secrets",
    });
  });

  test("fail to parse config string when missing options", () => {
    expect(() => parseConfig('{"sessionSecretPath": "/secrets"}')).toThrow();
  });

  test("fail to parse config string when including extra options", () => {
    expect(() =>
      parseConfig(
        '{"sdaBaseUrl": "https://test.local", "sessionSecretPath": "/secrets", "extra": "yes"}',
      ),
    ).toThrow();
  });
});
