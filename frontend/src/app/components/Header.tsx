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
          >
            Sensitive Data Archive
          </Link>
          <button
            className="navbar-toggler fs-2"
            type="button"
            aria-controls="navbarNav"
            aria-expanded={!isNavCollapsed}
            aria-label="Toggle navigation"
            onClick={handleNavCollapse}
          >
            <i className={`${isNavCollapsed ? "bi bi-list" : "bi bi-x-lg"}`} />
          </button>
          <div
            className={`${isNavCollapsed ? "collapse justify-content-end" : "d-flex justify-content-center"} navbar-collapse `}
            id="navbarNav"
          >
            <ul
              className={`${isNavCollapsed ? "" : "text-center w-100 pt-3"} navbar-nav`}
            >
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <li className="nav-item" key={link.href}>
                    <Link
                      className={`nav-link px-3 ${isActive ? "text-info" : ""}`}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
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
