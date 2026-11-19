
"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Department = {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  links: { label: string; href: string }[];
};

const departments: Department[] = [
  {
    title: "League Management",
    description: "Manage league nights, players, scores, and standings.",
    icon: "🏆",
    href: "/admin",
    color: "border-yellow-500/40",
    links: [
      { label: "Manage League", href: "/admin" },
      { label: "Scores", href: "/walking" },
      { label: "Standings", href: "/display" },
    ],
  },
  {
    title: "Facility Operations",
    description: "Manage court scheduling, TV screens, and facility tools.",
    icon: "📅",
    href: "/admin/facility-schedule",
    color: "border-blue-500/40",
    links: [
      {
        label: "Daily Schedule",
        href: "/admin/facility-schedule",
      },
      {
        label: "TV Manager",
        href: "/admin/tv-manager",
      },
      {
        label: "Wristband Colors",
        href: "/admin/facility-schedule/colors",
      },
    ],
  },
  {
    title: "PB101+ Guest Journey",
    description: "Manage beginner guests, attendance, and membership follow-ups.",
    icon: "🎓",
    href: "/admin/pb101",
    color: "border-green-500/40",
    links: [
      { label: "Guest Dashboard", href: "/admin/pb101" },
    ],
  },
  {
    title: "Player Management",
    description: "Manage player profiles and the player directory.",
    icon: "👥",
    href: "/admin/player-directory",
    color: "border-purple-500/40",
    links: [
      {
        label: "Player Directory",
        href: "/admin/player-directory",
      },
    ],
  },
  {
    title: "Club Rating",
    description: "Manage official ratings, renewals, requalification, and PodPlay.",
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
    description: "Additional staff tools and system administration.",
    icon: "⚙️",
    href: "/admin",
    color: "border-zinc-600",
    links: [
      { label: "Admin Dashboard", href: "/admin" },
    ],
  },
];

export default function Home() {
  return (
    <AppLayout
      title="PBK Northwest"
      description="Your central hub for Pickleball Kingdom daily operations."
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            PICKLEBALL KINGDOM
          </p>

          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Operations Hub
          </h2>

          <p className="mt-3 max-w-2xl text-zinc-400">
            Select a department below to access the tools you
            need for daily operations.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <div
              key={department.title}
              className={`flex flex-col rounded-2xl border ${department.color} bg-zinc-900/70 p-6 transition hover:bg-zinc-900`}
            >
              <Link
                href={department.href}
                className="group flex-1"
              >
                <div className="text-4xl">
                  {department.icon}
                </div>

                <h3 className="mt-5 text-xl font-bold text-white group-hover:text-yellow-400">
                  {department.title}
                </h3>

                <p className="mt-3 min-h-12 text-sm leading-relaxed text-zinc-400">
                  {department.description}
                </p>

                <span className="mt-4 inline-block text-sm font-semibold text-yellow-400">
                  Open Department →
                </span>
              </Link>

              <div className="mt-6 border-t border-zinc-700 pt-4">
                <div className="flex flex-wrap gap-2">
                  {department.links.map((link) => (
                    <Link
                      key={`${department.title}-${link.href}`}
                      href={link.href}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-yellow-500 hover:text-yellow-400"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-zinc-500">
          PBK Operations • Additional departments and tools
          will be added as the system grows.
        </p>
      </div>
    </AppLayout>
  );
}
