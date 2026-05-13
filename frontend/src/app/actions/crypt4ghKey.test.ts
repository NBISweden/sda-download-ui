import { expect, it, vi, describe } from "vitest";
import { postCrypt4GHPublicKey } from "./crypt4ghKey";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { getSessionManager } from "../lib/SessionManager";
import { SignJWT } from "jose";
import * as fs from "fs";

vi.mock(import("next/server"), () => {
  return {
    connection: async () => {},
  };
});

vi.mock(import("next/headers"), () => {
  return {
    cookies: async () => {
      const sessionManager = await getSessionManager();
      const token = await createMockToken();
      const sessionData = await sessionManager.createSessionJWT(
        { token },
        Date.now() + 1000,
      );

      return {
        set: () => {},
        get: () => ({
          value: sessionData,
        }),
      } as ReadonlyRequestCookies;
    },
  };
});

vi.mock("fs");

vi.mock(import("@/app/lib/config"), () => {
  return {
    getConfig: async () => ({
      sessionSecretPath: "no-secrets-in-test",
      sdaBaseUrl: "",
    }),
  };
});

vi.mock(import("server-only"), () => {
  return {};
});

async function createMockToken() {
  const secretKey = "no-secrets-in-testing";
  const secretBuffer = new TextEncoder().encode(secretKey);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1s")
    .sign(secretBuffer);
}

const pemContent = `-----BEGIN CRYPT4GH PUBLIC KEY-----
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
-----END CRYPT4GH PUBLIC KEY-----`;
const pemContentChecksum = "acc5931d0409670c4a86ba236e934cf2";

const badPemContent = "bad pem data";
const badSizePemContent = `-----BEGIN CRYPT4GH PUBLIC KEY-----
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
-----END CRYPT4GH PUBLIC KEY-----`;

describe("postCrypt4GHPublicKey server action", () => {
  vi.spyOn(fs, "readFileSync").mockReturnValue(
    "no-secrets-in-testing-no-secrets-in-testing",
  );

  it("should fail to process bad PEM key data", async () => {
    const formData: FormData = new FormData();
    formData.append("pemKey", badPemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({
      errors: ["Error: Missing PEM header and/or footer for PUBLIC key."],
    });
  });

  it("should fail to process PEM data with a wrong size key", async () => {
    const formData: FormData = new FormData();
    formData.append("pemKey", badSizePemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({
      errors: ["Error: Incorrect key length 43. Expected 44."],
    });
  });

  it("should successfully receive a PEM key data", async () => {
    const formData: FormData = new FormData();
    formData.append("pemKey", pemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({ pemChecksum: pemContentChecksum });
  });

  it("should successfully receive a PEM key file", async () => {
    const formData: FormData = new FormData();
    formData.append(
      "pemFile",
      new File([pemContent], "pemFile.pub", {
        type: "text/plain",
      }),
    );
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({ pemChecksum: pemContentChecksum });
  });

  it("should successfully remove the public key data", async () => {
    const formData: FormData = new FormData();
    formData.append("action", "remove");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({ messages: ["Public key removed."] });
  });
});
