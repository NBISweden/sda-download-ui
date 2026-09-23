import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/lib/serverToken", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/app/actions/crypt4ghKey", () => ({
  postCrypt4GHPublicKey: vi.fn(),
}));

vi.mock("jose", () => ({
  decodeJwt: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/userinfo",
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

import UserPage from "./page";
import { getSession } from "@/app/lib/serverToken";
import { postCrypt4GHPublicKey } from "@/app/actions/crypt4ghKey";
import { decodeJwt } from "jose";

describe("/userinfo (protected route)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("decodes no token and renders the sign-in prompt when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const html = renderToStaticMarkup(await UserPage());

    expect(getSession).toHaveBeenCalledOnce();
    expect(decodeJwt).not.toHaveBeenCalled();
    expect(postCrypt4GHPublicKey).not.toHaveBeenCalled();

    expect(html).toContain("Your session has expired or you are not signed in");
    expect(html).not.toContain("Crypt4gh public encryption key");
    expect(html).not.toContain("Signed in as");
  });
});
