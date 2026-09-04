import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect, RedirectType } from "next/navigation";
import { clearServerToken } from "@/app/lib/serverToken";
import { logout } from "./logout";

vi.mock("@/app/lib/serverToken", () => ({
  clearServerToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  RedirectType: { replace: "replace" },
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears the JWT cookie and redirects to the home page", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");

    expect(clearServerToken).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/", RedirectType.replace);
  });
});
