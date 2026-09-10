import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect, RedirectType } from "next/navigation";
import { clearServerToken } from "@/app/lib/serverToken";
import { getEndSessionEndpoint } from "@/app/lib/oidc";
import { logout, signOutOfIdp } from "./logout";

vi.mock("server-only", () => ({}));

vi.mock("@/app/lib/serverToken", () => ({
  clearServerToken: vi.fn(),
}));

vi.mock("@/app/lib/oidc", () => ({
  getEndSessionEndpoint: vi.fn(),
}));

vi.mock("@/app/lib/auth", () => ({
  getAuthConfig: () => ({
    oidcClientId: "my-client",
    oidcClientSecret: "cs",
    nextAuthSecret: "s",
  }),
}));

const configState: { postLogoutRedirectUri?: string } = {};

vi.mock("@/app/lib/config", () => ({
  getConfig: async () => ({ ...configState }),
}));

vi.mock("next/navigation", () => ({
  RedirectType: { replace: "replace" },
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("logout (local-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete configState.postLogoutRedirectUri;
  });

  it("clears the local session and lands on /logout", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");

    expect(clearServerToken).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/logout", RedirectType.replace);
  });

  it("does not touch the IdP end-session endpoint", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
    expect(getEndSessionEndpoint).not.toHaveBeenCalled();
  });

  it("clears the local session before redirecting", async () => {
    const callOrder: string[] = [];
    vi.mocked(clearServerToken).mockImplementation(async () => {
      callOrder.push("clear");
    });
    vi.mocked(redirect).mockImplementation(() => {
      callOrder.push("redirect");
      throw new Error("NEXT_REDIRECT");
    });

    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
    expect(callOrder).toEqual(["clear", "redirect"]);
  });
});

describe("signOutOfIdp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete configState.postLogoutRedirectUri;
  });

  it("clears the local session", async () => {
    vi.mocked(getEndSessionEndpoint).mockResolvedValue(
      "https://idp.example.com/logout",
    );

    await expect(signOutOfIdp()).rejects.toThrow("NEXT_REDIRECT");

    expect(clearServerToken).toHaveBeenCalledOnce();
  });

  it("redirects to the IdP end-session endpoint with client_id", async () => {
    vi.mocked(getEndSessionEndpoint).mockResolvedValue(
      "https://idp.example.com/logout",
    );

    await expect(signOutOfIdp()).rejects.toThrow("NEXT_REDIRECT");

    const [target, type] = vi.mocked(redirect).mock.calls[0];
    expect(type).toBe(RedirectType.replace);

    const url = new URL(target as string);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://idp.example.com/logout",
    );
    expect(url.searchParams.get("client_id")).toBe("my-client");
    expect(url.searchParams.has("post_logout_redirect_uri")).toBe(false);
  });

  it("never sends id_token_hint (in case someone naively adds this in the future after reading the documentation)", async () => {
    vi.mocked(getEndSessionEndpoint).mockResolvedValue(
      "https://idp.example.com/logout",
    );

    await expect(signOutOfIdp()).rejects.toThrow("NEXT_REDIRECT");

    const [target] = vi.mocked(redirect).mock.calls[0];
    const url = new URL(target as string);
    expect(url.searchParams.has("id_token_hint")).toBe(false);
  });

  it("includes post_logout_redirect_uri when configured", async () => {
    configState.postLogoutRedirectUri = "https://app.example.com/";
    vi.mocked(getEndSessionEndpoint).mockResolvedValue(
      "https://idp.example.com/logout",
    );

    await expect(signOutOfIdp()).rejects.toThrow("NEXT_REDIRECT");

    const [target] = vi.mocked(redirect).mock.calls[0];
    const url = new URL(target as string);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://app.example.com/",
    );
  });

  it("preserves existing query parameters on the end-session endpoint", async () => {
    vi.mocked(getEndSessionEndpoint).mockResolvedValue(
      "https://idp.example.com/logout?realm=main",
    );

    await expect(signOutOfIdp()).rejects.toThrow("NEXT_REDIRECT");

    const [target] = vi.mocked(redirect).mock.calls[0];
    const url = new URL(target as string);
    expect(url.searchParams.get("realm")).toBe("main");
    expect(url.searchParams.get("client_id")).toBe("my-client");
  });

  it("falls back to the home page when the OP does not advertise an end-session endpoint (this path should not be taken in normal operation due to canSignOutOfIdp)", async () => {
    vi.mocked(getEndSessionEndpoint).mockResolvedValue(null);

    await expect(signOutOfIdp()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/", RedirectType.replace);
  });
});
