"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/",
    label: "Home",
    icon: "🏠",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: "⚙️",
  },
  {
    href: "/walking",
    label: "Runner",
    icon: "🏃",
  },
  {
    href: "/tv",
    label: "TV",
    icon: "📺",
  },
  {
    href: "/display",
    label: "Display",
    icon: "🏆",
  },
  {
    href: "/live",
    label: "Live",
    icon: "📊",
  },
  {
    href: "/stats",
    label: "Stats",
    icon: "📈",
  },
  {
    href: "/history",
    label: "History",
    icon: "📚",
  },
];

function isActive(
  pathname: string,
  href: string,
) {
  if (href === "/") {
    return pathname === "/";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <nav
        aria-label="Primary navigation"
        className="hidden flex-col gap-2 md:flex"
      >
        {links.map((link) => {
          const active = isActive(
            pathname,
            link.href,
          );

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <span className="text-lg">
                {link.icon}
              </span>

              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950 md:hidden"
      >
        <div className="grid grid-cols-7">
          {links.map((link) => {
            const active = isActive(
              pathname,
              link.href,
            );

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center py-2 text-[11px] ${
                  active
                    ? "text-blue-400"
                    : "text-zinc-400"
                }`}
              >
                <span className="text-lg">
                  {link.icon}
                </span>

                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}