import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { createSDADSessionManager } from "./SessionManager";

// We need to mock the server only import for the test to work
vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("SessionManager.clearSession", () => {
  const deleteCookie = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(cookies).mockResolvedValue({
      delete: deleteCookie,
    } as never);
  });

  it("deletes the session cookie", async () => {
    const sessionManager = createSDADSessionManager("AA");

    await sessionManager.clearSession();

    expect(cookies).toHaveBeenCalledOnce();
    expect(deleteCookie).toHaveBeenCalledOnce();
    expect(deleteCookie).toHaveBeenCalledWith("sdad-session");
  });
});
