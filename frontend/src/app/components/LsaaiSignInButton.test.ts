import { describe, it, expect } from "vitest";
import { toCallbackUrl } from "./LsaaiSignInButton";

describe("toCallbackUrl", () => {
  it("keeps a relative in-app path", () => {
    expect(toCallbackUrl("/datasets")).toBe("/datasets");
  });

  it("keeps query string and hash", () => {
    expect(toCallbackUrl("/datasets?page=2#files")).toBe(
      "/datasets?page=2#files",
    );
  });

  it("rejects an absolute URL on another origin", () => {
    expect(toCallbackUrl("https://example.com/steal")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(toCallbackUrl("//example.com")).toBe("/");
    expect(toCallbackUrl("//example.com/path")).toBe("/");
  });

  it("rejects a path without a leading slash", () => {
    expect(toCallbackUrl("datasets")).toBe("/");
  });

  it("falls back to the root when undefined or empty", () => {
    expect(toCallbackUrl(undefined)).toBe("/");
    expect(toCallbackUrl("")).toBe("/");
  });

  // next-auth forwards callback URLs to the sign-in page in absolute form, so
  // sign-in flows it initiates fall back to the root rather than returning the
  // user to the page they came from. usePathname() gives a relative path, which
  // is why the common cases still work.
  it("falls back to the root for an absolute same-origin URL", () => {
    expect(toCallbackUrl("http://localhost:3002/userinfo")).toBe("/");
  });
});
