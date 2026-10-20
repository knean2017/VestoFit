"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Closet" },
  { href: "/shop", label: "Shop" },
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
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-line hidden md:block">
      <div className="container-app h-16 flex items-center justify-between">
        <Link href="/" className="display text-[28px] leading-none text-ink hover:text-accent transition-colors">
          VestoFit
        </Link>

        <nav className="flex items-center gap-7 text-[15px]">
          {authed ? (
            <>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={
                    "relative py-5 transition-colors " +
                    (isActive(link.href)
                      ? "text-ink font-semibold after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-accent"
                      : "text-muted hover:text-ink")
                  }
                >
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  clearToken();
                  router.replace("/login");
                }}
                className="text-muted hover:text-ink transition-colors pl-7 border-l border-line"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-ink hover:text-accent transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary h-10 px-4">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
