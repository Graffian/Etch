"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/", label: "Timestamp" },
  { href: "/verify", label: "Verify" },
] as const;

function isCurrentPath(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="Etch home">
            <span className="brand__mark" aria-hidden="true">
              E
            </span>
            <span className="brand__name">Etch</span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                className="nav-link"
                href={item.href}
                aria-current={
                  isCurrentPath(pathname, item.href) ? "page" : undefined
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="host-label">
            <span className="host-label__dot" aria-hidden="true" />
            SELF-HOSTED
          </p>
        </div>
      </header>
      <main id="main-content" className="site-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>Etch · tamper-evident file timestamping</p>
          <p>Anchoring is provided by your Etch server (mock chain by default).</p>
        </div>
      </footer>
    </div>
  );
}
