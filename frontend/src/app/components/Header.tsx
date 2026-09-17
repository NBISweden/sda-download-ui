"use client";

import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "../actions/logout";
import Link from "next/link";
import { FSABatchDownloadContext } from "./FileSystemAccessBatchDownloadContext";
import { useDownloadGuard } from "./DownloadGuard";

const NAV_LINKS = [
  { href: "/datasets", label: "Datasets", requiresAuth: true },
  { href: "/userinfo", label: "Your profile", requiresAuth: true },
  { href: "/help", label: "Help", requiresAuth: false },
];

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function Header({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const pathname = usePathname();

  const closeNav = () => setIsNavCollapsed(true);
  const toggleNav = () => setIsNavCollapsed((collapsed) => !collapsed);
  const fsaDownload = useContext(FSABatchDownloadContext);
  const currentDownload =
    fsaDownload && "currentDownload" in fsaDownload
      ? fsaDownload.currentDownload
      : null;

  const isHome = pathname === "/";
  const barClass = `bar ${isNavCollapsed ? "" : "is-active"}`;
  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.requiresAuth || isLoggedIn,
  );

  return (
    <header>
      <nav
        className="navbar navbar-expand-md bg-light p-3"
        data-bs-theme="light"
      >
        <div className="container-fluid fs-5">
          <Link
            className={`navbar-brand fs-4 ${isHome ? "text-info" : ""}`}
            href="/"
            aria-current={isHome ? "page" : undefined}
            onClick={closeNav}
          >
            Sensitive Data Archive
          </Link>
          <button
            className="navbar-toggler fs-2 d-flex flex-column d-md-none p-3 hamburger"
            type="button"
            aria-controls="navbarNav"
            aria-expanded={!isNavCollapsed}
            aria-label="Toggle navigation"
            onClick={toggleNav}
          >
            <span className={barClass}></span>
            <span className={barClass}></span>
            <span className={barClass}></span>
          </button>
          <div
            className={`navbar-collapse justify-content-end ${isNavCollapsed ? "nav-collapsed" : "nav-expanded"}`}
            id="navbarNav"
          >
            <ul className="navbar-nav text-center text-md-start mt-3 mt-md-0">
              {currentDownload ? (
                <li className="nav-item">
                  <a
                    className={`nav-link px-3 ${!currentDownload.isHidden ? "text-info" : ""}`}
                    onClick={() => currentDownload.setIsHidden(false)}
                  >
                    <i className="bi bi-download"></i>{" "}
                    {currentDownload.progress.estimatedProgressPercent}%
                  </a>
                </li>
              ) : (
                <></>
              )}
              {visibleLinks.map((link) => {
                const isActive = isActivePath(pathname, link.href);
                return (
                  <li className="nav-item" key={link.href}>
                    <Link
                      className={`nav-link px-3 ${isActive ? "text-info" : ""}`}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={closeNav}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              {isLoggedIn && (
                <li className="nav-item">
                  <LogoutButton onClick={closeNav} />
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}

function LogoutButton({ onClick }: { onClick: () => void }) {
  const { requestNavigation } = useDownloadGuard();

  return (
    <form action={logout}>
      <button
        type="submit"
        className="nav-link px-3 border-0 bg-transparent w-100 text-center text-md-start"
        onClick={(event) => {
          onClick();

          // Logging out ends the session the download needs, so it is
          // guarded like any other way of leaving the page.
          const form = event.currentTarget.form;

          if (form && !requestNavigation(() => form.requestSubmit())) {
            event.preventDefault();
          }
        }}
      >
        Logout
      </button>
    </form>
  );
}
