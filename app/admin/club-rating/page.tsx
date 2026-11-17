
import Link from "next/link";

import { requireStaffUser } from "@/lib/server/require-auth";
import { AppLayout } from "@/components/layout/AppLayout";

export const dynamic = "force-dynamic";

type Feature = {
  title: string;
  description: string;
  status: "Available" | "Coming soon";
  href?: string;
};

export default async function ClubRatingPage() {
  await requireStaffUser();

  const features: Feature[] = [
    {
      title: "Rating Sessions",
      description:
        "Create rating sessions, import PodPlay rosters, and manage player attendance.",
      status: "Available",
      href: "/admin/club-rating/sessions",
    },
    {
      title: "Player Ratings",
      description:
        "View player qualification progress, completed games, Club Ratings, and renewal status.",
      status: "Coming soon",
    },
    {
      title: "PB Vision Scores",
      description:
        "Record individual PB Vision game ratings for four players per video.",
      status: "Available",
      href: "/admin/club-rating/sessions",
    },
    {
      title: "Rating History",
      description:
        "Review official ratings, mandatory renewals, optional improvement attempts, and historical changes.",
      status: "Coming soon",
    },
  ];

  return (
    <AppLayout
      title="PBK Club Rating"
      description="Manage player evaluations, rating sessions, and Club Rating reliability."
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
            Club Rating Administration
          </p>

          <h2 className="mt-3 text-2xl font-bold text-white">
            Club Rating Dashboard
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
            Manage PBK Club Ratings independently from DUPR.
            Players qualify after 12 games and maintain their
            rating through qualifying six-game sessions.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => {
            const available =
              feature.status === "Available";

            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-white">
                    {feature.title}
                  </h3>

                  <span
                    className={
                      available
                        ? "rounded-full border border-green-800 bg-green-950 px-3 py-1 text-xs font-medium text-green-300"
                        : "rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
                    }
                  >
                    {feature.status}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  {feature.description}
                </p>

                {available && (
                  <p className="mt-5 text-sm font-semibold text-blue-400">
                    Open {feature.title} →
                  </p>
                )}
              </>
            );

            const className =
              "block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition-colors";

            return feature.href ? (
              <Link
                key={feature.title}
                href={feature.href}
                className={`${className} hover:border-blue-500/50 hover:bg-zinc-800`}
              >
                {content}
              </Link>
            ) : (
              <div
                key={feature.title}
                className={className}
              >
                {content}
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="text-lg font-bold text-white">
            Rating Program Rules
          </h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-3xl font-black text-yellow-400">
                12
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Games for initial qualification
              </p>
            </div>

            <div>
              <p className="text-3xl font-black text-yellow-400">
                6
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Minimum games per renewal session
              </p>
            </div>

            <div>
              <p className="text-3xl font-black text-yellow-400">
                3 months
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Rating reliability period
              </p>
            </div>
          </div>
        </section>

        <Link
          href="/admin"
          className="inline-flex rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Back to Admin Dashboard
        </Link>
      </div>
    </AppLayout>
  );
}
