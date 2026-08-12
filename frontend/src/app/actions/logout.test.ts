import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect, RedirectType } from "next/navigation";
import { clearSession } from "../lib/session";
import { logout } from "./logout";

vi.mock("../lib/session", () => ({
  clearSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  RedirectType: {
    replace: "replace",
  },
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the session and redirects to the home page", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");

    expect(clearSession).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/", RedirectType.replace);
  });
});
