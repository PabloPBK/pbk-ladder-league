
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useFrontDesk } from "@/components/auth/useFrontDesk";
import { rosterWorkspace } from "@/lib/data/league-directory";

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
    links: [
      {
        href: "/",
        label: "Operations Hub",
        icon: "🏠",
      },
    ],
  },
  {
    id: "league",
    label: "League Management",
    icon: "🏆",
    links: [],
  },
  {
    id: "facility",
    label: "Facility Operations",
    icon: "🗓️",
    links: [
      {
        href: "/admin/facility-schedule",
        label: "Daily Schedule Manager",
        icon: "🗓️",
      },
      {
        href: "/admin/facility-schedule/colors",
        label: "Wristband Colors",
        icon: "🎨",
      },
      {
        href: "/admin/open-play-no-shows",
        label: "Open-play no-shows",
        icon: "📋",
      },
      {
        href: "/admin/tv-manager",
        label: "TV Display Manager",
        icon: "🖥️",
      },
    ],
  },
  {
    id: "pb101",
    label: "PB101+ Guest Journey",
    icon: "🎓",
    links: [
      {
        href: "/admin/pb101",
        label: "PB101+ Dashboard",
        icon: "📊",
      },
      {
        href: "/admin/pb101/guests",
        label: "Guest Registration",
        icon: "👤",
      },
      {
        href: "/admin/pb101/attendance",
        label: "Daily Attendance",
        icon: "📅",
      },
      {
        href: "/admin/pb101/emails",
        label: "Automated Emails",
        icon: "✉️",
      },
      {
        href: "/admin/pb101/reports",
        label: "Reports",
        icon: "📈",
      },
    ],
  },
  {
    id: "players",
    label: "Player Management",
    icon: "👥",
    links: [
      {
        href: "/admin/player-directory",
        label: "Player Directory",
        icon: "📋",
      },
    ],
  },
  {
    id: "club-rating",
    label: "Club Rating",
    icon: "📊",
    links: [
      {
        href: "/admin/club-rating/players",
        label: "Player Ratings",
        icon: "⭐",
      },
      {
        href: "/admin/club-rating/overdue",
        label: "Overdue Players",
        icon: "⏰",
      },
      {
        href: "/admin/club-rating/restorations",
        label: "PodPlay Restorations",
        icon: "🔄",
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "⚙️",
    links: [
      {
        href: "/admin",
        label: "Admin Dashboard",
        icon: "🛠️",
      },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";

  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeGroup(pathname: string) {
  if (pathname === "/admin/revenue") return "administration";
  if (pathname === "/leagues" || pathname === "/admin" || pathname === rosterWorkspace || pathname === "/admin/leagues/new") return "league";

  const matches = groups.flatMap((group) =>
    group.links
      .filter((link) => isActive(pathname, link.href))
      .map((link) => ({
        id: group.id,
        length: link.href.length,
      })),
  );

  matches.sort((a, b) => b.length - a.length);

  return matches[0]?.id ?? "general";
}

export function Navigation() {
  const pathname = usePathname();
  const currentGroup = activeGroup(pathname);
  const frontDesk = useFrontDesk();

  const [expanded, setExpanded] = useState<string[]>([currentGroup]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [revenueAllowed, setRevenueAllowed] = useState(false);
  const administrationOpen = expanded.includes("administration");

  useEffect(() => {
    if (!administrationOpen || frontDesk !== false) return;
    const abort = new AbortController();
    void fetch("/api/league-revenue/access", { cache: "no-store", signal: abort.signal })
      .then((response) => {
        if (!abort.signal.aborted) setRevenueAllowed(response.ok);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [administrationOpen, frontDesk]);

  useEffect(() => {
    setExpanded((previous) =>
      previous.includes(currentGroup)
        ? previous
        : [...previous, currentGroup],
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
    return (frontDesk === false ? groups : groups.filter(({ id }) => id === "league")).map((group) => {
      if (group.id === "league") return (
        <Link key={group.id} href="/leagues" onClick={() => setMobileOpen(false)}
          aria-current={pathname === "/leagues" ? "page" : undefined}
          className="mb-2 block rounded-xl px-3 py-3 text-sm font-bold text-zinc-200 hover:bg-zinc-800">
          Leagues
        </Link>
      );
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
            <div
              id={`nav-group-${group.id}`}
              className="mt-1 space-y-1 pl-2"
            >
              {group.id === "administration" && revenueAllowed && (
                <Link href="/admin/revenue" aria-current={pathname === "/admin/revenue" ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
                  Revenue Details
                </Link>
              )}
              {group.links.map((link) => {
                const active = isActive(pathname, link.href);

                return (
                  <Link
                    key={`${group.id}-${link.href}`}
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
      <nav
        aria-label="Primary navigation"
        className="hidden flex-col md:flex"
      >
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
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="text-sm font-bold text-yellow-400"
          >
            🏠 Home
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((previous) => !previous)}
            aria-expanded={mobileOpen}
            aria-label={
              mobileOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white"
          >
            {mobileOpen ? "Close ✕" : "☰ Menu"}
          </button>
        </div>
      </div>
    </>
  );
}
