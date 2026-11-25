
"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

const eventTypes = [
  {
    title: "Tournaments",
    description: "Create tournaments for ZZ2 Pickleball and PBK Northwest.",
    icon: "🏆",
    href: "/admin/events/tournaments",
    color: "border-yellow-500/50",
  },
  {
    title: "Leagues",
    description: "Create leagues and recurring competitions.",
    icon: "🎾",
    href: "/admin/events/leagues",
    color: "border-blue-500/40",
  },
  {
    title: "Social Events",
    description: "Organize community and social activities.",
    icon: "🎉",
    color: "border-green-500/40",
  },
  {
    title: "Other Events",
    description: "Create other programs and facility events.",
    icon: "📅",
    color: "border-purple-500/40",
  },
];

export default function EventsPage() {
  return (
    <AppLayout
      title="Add an Event"
      description="Choose the type of event you want to create."
    >
      <div className="space-y-5">
        <Link
          href="/"
          className="text-sm font-semibold text-yellow-400 hover:underline"
        >
          ← Back to Operations Hub
        </Link>

        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
          <h2 className="text-2xl font-black text-white">
            What would you like to create?
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Select an event category to continue.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {eventTypes.map((event) => {
            const content = (
              <>
                <span className="text-3xl">{event.icon}</span>
                <h3 className="mt-4 text-lg font-bold text-white">
                  {event.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {event.description}
                </p>
                <p className="mt-4 text-xs font-semibold text-yellow-400">
                  {event.href ? "Continue →" : "Coming Soon"}
                </p>
              </>
            );

            const classes = `block rounded-xl border ${event.color} bg-zinc-900/70 p-5 ${
              event.href
                ? "transition hover:bg-zinc-800"
                : "opacity-60"
            }`;

            return event.href ? (
              <Link
                key={event.title}
                href={event.href}
                className={classes}
              >
                {content}
              </Link>
            ) : (
              <div key={event.title} className={classes}>
                {content}
              </div>
            );
          })}
        </section>
      </div>
    </AppLayout>
  );
}
