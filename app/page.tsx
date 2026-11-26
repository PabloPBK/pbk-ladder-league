
"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Department = {
  title: string;
  description: string;
  icon: string;
  href?: string;
  color: string;
  comingSoon?: boolean;
  links: { label: string; href: string }[];
};

const departments: Department[] = [
  {
    title: "League Management",
    description: "Players, scores, and standings.",
    icon: "🏆",
    href: "/admin",
    color: "border-yellow-500/40",
    links: [
      { label: "Manage League", href: "/admin" },
      { label: "Event Roster Manager", href: "/admin/tv-manager/rosters" },
      { label: "Scores", href: "/walking" },
      { label: "Standings", href: "/display" },
    ],
  },
  {
    title: "Facility Operations",
    description: "Court scheduling and facility tools.",
    icon: "📅",
    href: "/admin/facility-schedule",
    color: "border-blue-500/40",
    links: [
      { label: "Daily Schedule", href: "/admin/facility-schedule" },
      { label: "Open-play no-shows", href: "/admin/open-play-no-shows" },
      { label: "TV Manager", href: "/admin/tv-manager" },
      {
        label: "Wristband Colors",
        href: "/admin/facility-schedule/colors",
      },
    ],
  },
  {
    title: "PB101+ Guest Journey",
    description: "Beginner guests and follow-ups.",
    icon: "🎓",
    href: "/admin/pb101",
    color: "border-green-500/40",
    links: [
      { label: "Guest Dashboard", href: "/admin/pb101" },
    ],
  },
  {
    title: "Player Management",
    description: "Player profiles and directory.",
    icon: "👥",
    href: "/admin/player-directory",
    color: "border-purple-500/40",
    links: [
      { label: "Player Directory", href: "/admin/player-directory" },
    ],
  },
  {
    title: "Club Rating",
    description: "Ratings, renewals, and PodPlay.",
    icon: "📊",
    href: "/admin/club-rating/players",
    color: "border-orange-500/40",
    links: [
      {
        label: "Player Ratings",
        href: "/admin/club-rating/players",
      },
      {
        label: "Overdue Players",
        href: "/admin/club-rating/overdue",
      },
      {
        label: "PodPlay Restorations",
        href: "/admin/club-rating/restorations",
      },
    ],
  },
  {
    title: "Administration",
    description: "Staff and system administration.",
    icon: "⚙️",
    href: "/admin",
    color: "border-zinc-600",
    links: [
      { label: "Admin Dashboard", href: "/admin" },
    ],
  },
  {
    title: "Add an Event",
    description: "Tournaments, leagues, and social events.",
    icon: "🎟️",
    href: "/admin/events",
    color: "border-yellow-400/70",
    links: [
      { label: "Create Event", href: "/admin/events" },
      { label: "League Publishing", href: "/admin/events/leagues" },
    ],
  },
  {
    title: "Team Communication",
    description: "Staff messaging and announcements.",
    icon: "💬",
    color: "border-cyan-500/30",
    comingSoon: true,
    links: [],
  },
  {
    title: "Facility Maintenance",
    description: "Repairs, inspections, and work orders.",
    icon: "🔧",
    color: "border-red-500/30",
    comingSoon: true,
    links: [],
  },
];

export default function Home() {
  return (
    <AppLayout
      title="PBK Northwest"
      description="Your central hub for Pickleball Kingdom daily operations."
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            PICKLEBALL KINGDOM
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Operations Hub
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Select a department to access your tools.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <div
              key={department.title}
              className={`flex min-h-[190px] flex-col rounded-xl border ${department.color} bg-zinc-900/70 p-4 transition ${
                department.comingSoon
                  ? "opacity-65"
                  : "hover:bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">
                  {department.icon}
                </span>

                {department.comingSoon && (
                  <span className="rounded-full border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Coming Soon
                  </span>
                )}
              </div>

              {department.href ? (
                <Link
                  href={department.href}
                  className="group mt-3 block"
                >
                  <h3 className="text-base font-bold text-white group-hover:text-yellow-400">
                    {department.title}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {department.description}
                  </p>

                  <span className="mt-2 inline-block text-xs font-semibold text-yellow-400">
                    Open Department →
                  </span>
                </Link>
              ) : (
                <div className="mt-3">
                  <h3 className="text-base font-bold text-white">
                    {department.title}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {department.description}
                  </p>

                  <span className="mt-2 inline-block text-xs font-semibold text-zinc-500">
                    Coming Soon
                  </span>
                </div>
              )}

              {department.links.length > 0 && (
                <div className="mt-auto border-t border-zinc-700/70 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {department.links.map((link) => (
                      <Link
                        key={`${department.title}-${link.href}-${link.label}`}
                        href={link.href}
                        className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-yellow-500 hover:text-yellow-400"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-zinc-500">
          PBK Operations • Northwest
        </p>
      </div>
    </AppLayout>
  );
}
