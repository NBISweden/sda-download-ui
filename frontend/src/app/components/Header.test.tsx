import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("../actions/logout", () => ({
  logout: vi.fn(),
}));

vi.mock("./DownloadGuard", () => ({
  GuardedLink: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
  useDownloadGuard: () => ({ requestNavigation: () => true }),
}));

describe("Header", () => {
  it("only shows public links when signed out", () => {
    const html = renderToStaticMarkup(<Header isLoggedIn={false} />);

    expect(html).toContain("Help");
    expect(html).not.toContain("Datasets");
    expect(html).not.toContain("Your profile");
    expect(html).not.toContain("Logout");
  });

  it("shows links that require sign-in when signed in", () => {
    const html = renderToStaticMarkup(<Header isLoggedIn={true} />);

    expect(html).toContain("Help");
    expect(html).toContain("Datasets");
    expect(html).toContain("Your profile");
    expect(html).toContain("Logout");
  });
});
