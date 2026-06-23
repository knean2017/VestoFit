"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Closet" },
  { href: "/studio", label: "Studio" },
  { href: "/settings", label: "Profile" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/home";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-lg bg-surface/80 border-b border-line hidden md:block">
      <div className="container-app h-16 flex items-center justify-between">
        <Link href={authed ? "/" : "/"} className="flex items-center gap-2.5 group">
          <span className="w-8 h-8 rounded-xl bg-coral text-white grid place-items-center text-sm font-extrabold shadow-glow group-hover:scale-105 transition-transform">
            F
          </span>
          <span className="font-extrabold tracking-tight text-lg text-ink">
            FitMe
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {authed ? (
            <>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 " +
                    (isActive(link.href)
                      ? "text-coral font-extrabold relative after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-coral after:to-[#FF8F6B]"
                      : "text-muted hover:text-ink hover:bg-surface2")
                  }
                >
                  {link.label}
                </Link>
              ))}
              <div className="w-px h-6 bg-line mx-2" />
              <button
                type="button"
                onClick={() => {
                  clearToken();
                  router.replace("/login");
                }}
                className="text-sm font-semibold text-muted hover:text-coral transition-colors px-3 py-2"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-muted hover:text-ink transition-colors px-4 py-2"
              >
                Sign in
              </Link>
              <Link href="/register" className="btn-primary text-sm px-5 py-2.5">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
