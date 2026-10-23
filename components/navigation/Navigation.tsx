"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavLink = {
  href: string;
  label: string;
  icon: string;
};

type NavGroup = {
  id: string;
  label: string;
  icon: string;
  links: NavLink[];
};

const groups: NavGroup[] = [
  {
    id: "general",
    label: "General",
    icon: "🏠",
    links: [{ href: "/", label: "Home", icon: "🏠" }],
  },
  {
    id: "league",
    label: "League Management",
    icon: "🏆",
    links: [
      { href: "/admin", label: "League Admin", icon: "⚙️" },
      { href: "/admin/players", label: "Import Players", icon: "👥" },
      { href: "/walking", label: "Score Management", icon: "🏃" },
      { href: "/tv", label: "Today's Standings", icon: "📺" },
      { href: "/display", label: "Season Standings", icon: "🏆" },
      { href: "/stats", label: "Stats", icon: "📈" },
      { href: "/history", label: "History", icon: "📚" },
    ],
  },
  {
    id: "facility",
    label: "Facility Operations",
    icon: "🗓️",
    links: [
      { href: "/admin/facility-schedule", label: "Daily Schedule Manager", icon: "🗓️" },
      { href: "/admin/facility-schedule/colors", label: "Wristband Colors", icon: "🎨" },
      { href: "/admin/tv-manager", label: "TV Display Manager", icon: "🖥️" },
    ],
  },
  {
    id: "players",
    label: "Player Management",
    icon: "👥",
    links: [
      { href: "/admin/player-directory", label: "Player Directory", icon: "📋" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeGroup(pathname: string) {
  // Prefer the most specific matching route when a parent has child pages.
  const matches = groups.flatMap((group) =>
    group.links
      .filter((link) => isActive(pathname, link.href))
      .map((link) => ({ id: group.id, length: link.href.length })),
  );
  matches.sort((a, b) => b.length - a.length);
  return matches[0]?.id ?? "general";
}

export function Navigation() {
  const pathname = usePathname();
  const currentGroup = activeGroup(pathname);
  const [expanded, setExpanded] = useState<string[]>([currentGroup]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setExpanded((previous) =>
      previous.includes(currentGroup) ? previous : [...previous, currentGroup],
    );
    setMobileOpen(false);
  }, [currentGroup, pathname]);

  function toggleGroup(id: string) {
    setExpanded((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }

  function renderGroups() {
    return groups.map((group) => {
      const open = expanded.includes(group.id);
      const selected = currentGroup === group.id;
      return (
        <div key={group.id} className="mb-2">
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            aria-expanded={open}
            aria-controls={`nav-group-${group.id}`}
            className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${
              selected
                ? "bg-zinc-800 text-yellow-400"
                : "text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">{group.icon}</span>
              <span>{group.label}</span>
            </span>
            <span aria-hidden="true" className="text-xs text-zinc-400">
              {open ? "▾" : "▸"}
            </span>
          </button>
          {open && (
            <div id={`nav-group-${group.id}`} className="mt-1 space-y-1 pl-2">
              {group.links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <span aria-hidden="true">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <>
      <nav aria-label="Primary navigation" className="hidden flex-col md:flex">
        {renderGroups()}
      </nav>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950 md:hidden">
        {mobileOpen && (
          <nav
            aria-label="Mobile navigation"
            className="max-h-[70vh] overflow-y-auto border-b border-zinc-800 p-3"
          >
            {renderGroups()}
          </nav>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" onClick={() => setMobileOpen(false)} className="text-sm font-bold text-yellow-400">
            🏠 Home
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((previous) => !previous)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white"
          >
            {mobileOpen ? "Close ✕" : "☰ Menu"}
          </button>
        </div>
      </div>
    </>
  );
}
