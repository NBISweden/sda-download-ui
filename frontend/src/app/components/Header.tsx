"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export function Header() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const pathname = usePathname();

  const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);

  const navLinks = [
    { href: "/datasets", label: "Datasets" },
    { href: "/userinfo", label: "Your profile" },
    { href: "/logout", label: "Logout" },
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
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
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
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}
