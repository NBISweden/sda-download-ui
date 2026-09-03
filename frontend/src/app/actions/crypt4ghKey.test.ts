import { describe, it, expect, vi, beforeEach } from "vitest";
import { postCrypt4GHPublicKey } from "./crypt4ghKey";
import { updateServerToken, SessionInvalidError } from "@/app/lib/serverToken";

vi.mock("server-only", () => ({}));

vi.mock("@/app/lib/serverToken", () => ({
  updateServerToken: vi.fn(),
}));

vi.mock("@/app/lib/serverToken", () => ({
  updateServerToken: vi.fn(),
  SessionInvalidError: class SessionInvalidError extends Error {
    constructor(msg?: string) {
      super(msg);
      this.name = "SessionInvalidError";
    }
  },
}));

const pemContent = `-----BEGIN CRYPT4GH PUBLIC KEY-----
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
-----END CRYPT4GH PUBLIC KEY-----`;
const pemContentChecksum = "acc5931d0409670c4a86ba236e934cf2";
const expectedKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const badPemContent = "bad pem data";
const badSizePemContent = `-----BEGIN CRYPT4GH PUBLIC KEY-----
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
-----END CRYPT4GH PUBLIC KEY-----`;

describe("postCrypt4GHPublicKey server action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fail to process bad PEM key data", async () => {
    const formData: FormData = new FormData();
    formData.append("pemKey", badPemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({
      errors: ["Missing PEM header and/or footer for PUBLIC key."],
    });
    expect(updateServerToken).not.toHaveBeenCalled();
  });

  it("should fail to process PEM data with a wrong size key", async () => {
    const formData: FormData = new FormData();
    formData.append("pemKey", badSizePemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({
      errors: ["Incorrect key length 43. Expected 44."],
    });
    expect(updateServerToken).not.toHaveBeenCalled();
  });

  it("should store the public key on the JWT when given PEM text", async () => {
    const formData: FormData = new FormData();
    formData.append("pemKey", pemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({ pemChecksum: pemContentChecksum });
    expect(updateServerToken).toHaveBeenCalledWith({
      publicKey: { key: expectedKey, pemChecksum: pemContentChecksum },
    });
  });

  it("should store the public key on the JWT when given a PEM file", async () => {
    const formData: FormData = new FormData();
    formData.append(
      "pemFile",
      new File([pemContent], "pemFile.pub", { type: "text/plain" }),
    );
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({ pemChecksum: pemContentChecksum });
    expect(updateServerToken).toHaveBeenCalledWith({
      publicKey: { key: expectedKey, pemChecksum: pemContentChecksum },
    });
  });

  it("should clear the public key on the JWT when removing", async () => {
    const formData: FormData = new FormData();
    formData.append("action", "remove");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({ messages: ["Public key removed."] });
    expect(updateServerToken).toHaveBeenCalledWith({ publicKey: null });
  });

  it("should not leak unexpected error details to the client", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(updateServerToken).mockRejectedValueOnce(
      new Error("SECRET_INTERNAL_DETAIL"),
    );
    const formData = new FormData();
    formData.append("pemKey", pemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({
      errors: ["Could not save the public key. Please try again."],
    });
    expect(JSON.stringify(data)).not.toContain("SECRET_INTERNAL_DETAIL");
    expect(consoleError).toHaveBeenCalledWith(
      "crypt4gh key upload failed:",
      expect.any(Error),
    );
  });

  it("surfaces a specific message when the session has become invalid", async () => {
    vi.mocked(updateServerToken).mockRejectedValueOnce(
      new SessionInvalidError(),
    );

    const formData = new FormData();
    formData.append("pemKey", pemContent);
    formData.append("action", "submit");

    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({
      errors: ["Your session is no longer valid. Please sign in again."],
    });
  });
});
