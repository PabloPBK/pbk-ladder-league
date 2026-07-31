import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/admin", label: "Admin" },
  { href: "/walking", label: "Walking" },
  { href: "/tv", label: "TV" },
  { href: "/live", label: "Live" },
];

export function Navigation() {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex flex-wrap justify-center gap-2"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-blue-500 hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
