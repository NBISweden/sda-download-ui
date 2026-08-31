import { describe, it, expect, vi, beforeEach } from "vitest";
import { postCrypt4GHPublicKey } from "./crypt4ghKey";
import { updateServerToken } from "@/app/lib/serverToken";

vi.mock("server-only", () => ({}));

vi.mock("@/app/lib/serverToken", () => ({
  updateServerToken: vi.fn(),
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
      errors: ["Error: Missing PEM header and/or footer for PUBLIC key."],
    });
    expect(updateServerToken).not.toHaveBeenCalled();
  });

  it("should fail to process PEM data with a wrong size key", async () => {
    const formData: FormData = new FormData();
    formData.append("pemKey", badSizePemContent);
    formData.append("action", "submit");
    const data = await postCrypt4GHPublicKey({}, formData);

    expect(data).toEqual({
      errors: ["Error: Incorrect key length 43. Expected 44."],
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
});
