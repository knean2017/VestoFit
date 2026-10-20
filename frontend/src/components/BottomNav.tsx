"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21V14a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" />
        <path d="M3 10.182V22h18V10.182a1 1 0 0 0-.364-.773l-8-6.545a1 1 0 0 0-1.272 0l-8 6.545A1 1 0 0 0 3 10.182Z" />
      </svg>
    ),
  },
  {
    href: "/wardrobe",
    label: "Closet",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" />
        <path d="M12 5v16" />
        <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" />
        <path d="M8 10h1" />
        <path d="M15 10h1" />
      </svg>
    ),
  },
  {
    href: "/shop",
    label: "Shop",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    href: "/studio",
    label: "Studio",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 13L2 9Z" />
        <path d="M11 3l1 7 1-7" />
        <path d="M2 9h20" />
        <path d="M7 9l5 13 5-13" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Profile",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/home";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-md border-t border-line md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex flex-col items-center justify-center gap-1 min-w-[4rem] transition-colors " +
                (active ? "text-ink" : "text-muted hover:text-ink")
              }
            >
              {active && <span className="absolute top-0 left-4 right-4 h-[2px] bg-accent" />}
              {tab.icon(active)}
              <span className={"text-[11px] " + (active ? "font-semibold" : "font-medium")}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
