import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionManager } from "./SessionManager";
import { clearSession } from "./session";

// We need to mock the server only import for the test to work
vi.mock("server-only", () => ({}));

vi.mock("./SessionManager", () => ({
  getSessionManager: vi.fn(),
}));

describe("clearSession", () => {
  const managerClearSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSessionManager).mockResolvedValue({
      clearSession: managerClearSession,
    } as never);
  });

  it("gets the session manager and clears the session", async () => {
    await clearSession();

    expect(getSessionManager).toHaveBeenCalledOnce();
    expect(managerClearSession).toHaveBeenCalledOnce();
  });
});
