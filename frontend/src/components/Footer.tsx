import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/pricing", label: "Pricing" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="container-app py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
        <p className="font-medium">© VestoFit {new Date().getFullYear()}</p>
        <nav className="flex items-center gap-5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-coral transition-colors font-semibold"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="font-medium italic">Made for the well-dressed.</p>
      </div>
    </footer>
  );
}
