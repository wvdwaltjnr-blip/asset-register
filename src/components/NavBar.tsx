"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import { BASE_PATH } from "@/lib/basePath";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export default function NavBar({ currentUser }: { currentUser: CurrentUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Register" },
    { href: "/reports", label: "Reports" },
    ...(currentUser?.role === "admin"
      ? [
          { href: "/settings", label: "Settings" },
          { href: "/users", label: "Users" },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-brand px-4 py-2.5 text-white shadow-sm md:hidden">
        <Link href="/" onClick={() => setOpen(false)}>
          <span className="inline-flex items-center rounded-md bg-white px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE_PATH}/logo.png`} alt="Eezi Move International" className="h-5 w-auto" />
          </span>
        </Link>
        <button
          type="button"
          className="rounded-md p-2 text-white/90 hover:bg-white/10"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </header>
      {open && (
        <nav className="sticky top-[52px] z-20 border-t border-white/10 bg-brand px-4 pb-3 text-sm text-white md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2 transition-colors ${
                  isActive(pathname, l.href)
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-white/10 px-3 pt-2">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white">
              ← Back to main site
            </a>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 px-3 pt-2 text-white/70">
            <span>{currentUser ? `${currentUser.name} · ${currentUser.role}` : "Not signed in"}</span>
            {currentUser && (
              <form action="/logout" method="POST">
                <button type="submit" className="underline decoration-white/30 hover:text-white">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-y-auto bg-brand text-white md:flex">
        <Link href="/" className="block px-5 py-5">
          <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE_PATH}/logo.png`} alt="Eezi Move International" className="h-7 w-auto" />
          </span>
          <span className="mt-2 block text-xs font-medium tracking-wide text-white/60">Asset Register</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(pathname, l.href)
                  ? "bg-white/15 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="block rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white">
            ← Back to main site
          </a>
        </div>
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <div className="text-white/90">{currentUser ? currentUser.name : "Not signed in"}</div>
          {currentUser && <div className="text-xs text-white/50">{currentUser.role}</div>}
          {currentUser && (
            <form action="/logout" method="POST">
              <button type="submit" className="mt-2 text-xs text-white/70 underline decoration-white/30 hover:text-white">
                Sign out
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}
