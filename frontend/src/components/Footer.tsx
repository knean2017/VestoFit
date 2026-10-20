import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/pricing", label: "Pricing" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="container-app py-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <p className="display text-[56px] sm:text-[72px] leading-[0.85] text-ink">VestoFit</p>
        <div className="flex flex-col sm:items-end gap-3 text-[14px]">
          <nav className="flex items-center gap-6">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-ink hover:text-accent transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-muted">© {new Date().getFullYear()} VestoFit</p>
        </div>
      </div>
    </footer>
  );
}
