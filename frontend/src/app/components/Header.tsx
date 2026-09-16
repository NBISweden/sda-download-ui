"use client";

import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "../actions/logout";
import Link from "next/link";
import { FSABatchDownloadContext } from "./FileSystemAccessBatchDownloadContext";
import { useDownloadGuard } from "./DownloadGuard";

export function Header() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const pathname = usePathname();
  const { requestNavigation } = useDownloadGuard();

  const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);
  const fsaDownload = useContext(FSABatchDownloadContext);
  const currentDownload =
    fsaDownload && "currentDownload" in fsaDownload
      ? fsaDownload.currentDownload
      : null;

  const navLinks = [
    { href: "/datasets", label: "Datasets" },
    { href: "/userinfo", label: "Your profile" },
    { href: "/help", label: "Help" },
  ];

  const isHome = pathname === "/";

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
            onClick={() => setIsNavCollapsed(true)}
          >
            Sensitive Data Archive
          </Link>
          <button
            className="navbar-toggler fs-2 d-flex flex-column d-md-none p-3 hamburger"
            type="button"
            aria-controls="navbarNav"
            aria-expanded={!isNavCollapsed}
            aria-label="Toggle navigation"
            onClick={handleNavCollapse}
          >
            <span className={`bar ${isNavCollapsed ? "" : "is-active"}`}></span>
            <span className={`bar ${isNavCollapsed ? "" : "is-active"}`}></span>
            <span className={`bar ${isNavCollapsed ? "" : "is-active"}`}></span>
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
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href + "/"));
                return (
                  <li className="nav-item" key={link.href}>
                    <Link
                      className={`nav-link px-3 ${isActive ? "text-info" : ""}`}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsNavCollapsed(true)}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}

              <li className="nav-item">
                <form action={logout}>
                  <button
                    type="submit"
                    className="nav-link px-3 border-0 bg-transparent w-100 text-center text-md-start"
                    onClick={(event) => {
                      setIsNavCollapsed(true);

                      // Logging out ends the session the download needs, so it is
                      // guarded like any other way of leaving the page.
                      const form = event.currentTarget.form;

                      if (
                        form &&
                        !requestNavigation(() => form.requestSubmit())
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Logout
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}
