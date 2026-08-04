"use client";

import { useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PBKButton } from "@/components/ui/PBKButton";

type DashboardResponse = {
  league: string | null;
  season: string | null;
  event: {
    id: string;
    name: string;
    date: string;
    status: string;
    currentRound: number;
    session: number;
  } | null;
  summary: {
    checkedIn: number;
    courts: number;
  };
};

export default function Home() {
  const [data, setData] =
    useState<DashboardResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(
          "/api/dashboard",
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const result =
          (await response.json()) as
            | DashboardResponse
            | {
                error?: string;
              };

        if (!response.ok) {
          throw new Error(
            "error" in result
              ? result.error ??
                  "Unable to load dashboard."
              : "Unable to load dashboard.",
          );
        }

        if (!cancelled) {
          setData(
            result as DashboardResponse,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout
      title="PBK League Manager"
      description="Run league night from setup through final results."
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 text-center text-blue-300">
            Loading dashboard...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          data?.event && (
            <>
              <section className="rounded-2xl border border-green-500/40 bg-green-500/10 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
                  Active League Night
                </p>

                <h2 className="mt-2 text-3xl font-bold text-white">
                  {data.event.name}
                </h2>

                <p className="mt-2 text-zinc-300">
                  {data.league ?? "League"} ·{" "}
                  {data.season ?? "Season"} ·
                  Session {data.event.session}
                </p>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardCard
                  title="Status"
                  value={data.event.status.toUpperCase()}
                  valueClassName="text-green-400"
                />

                <DashboardCard
                  title="Current Round"
                  value={String(
                    data.event.currentRound,
                  )}
                />

                <DashboardCard
                  title="Players"
                  value={String(
                    data.summary.checkedIn,
                  )}
                />

                <DashboardCard
                  title="Courts"
                  value={String(
                    data.summary.courts,
                  )}
                />
              </section>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PBKButton
                  href="/admin"
                  primary
                >
                  Resume League Night
                </PBKButton>

                <PBKButton href="/admin/players">
                  Import / Edit Roster
                </PBKButton>

                <PBKButton href="/walking">
                  Runner Mode
                </PBKButton>

                <PBKButton href="/tv">
                  TV Display
                </PBKButton>

                <PBKButton href="/display">
                  Club Standings
                </PBKButton>

                <PBKButton href="/history">
                  History
                </PBKButton>
              </section>
            </>
          )}

        {!isLoading &&
          !errorMessage &&
          !data?.event && (
            <>
              <section className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                  No Active League Night
                </p>

                <h2 className="mt-2 text-3xl font-bold text-white">
                  Ready to start
                </h2>

                <p className="mt-2 max-w-2xl text-zinc-300">
                  Select the league and season,
                  start the session, import the
                  PodPlay roster, and check players
                  in.
                </p>

                <div className="mt-6 max-w-sm">
                  <PBKButton
                    href="/setup"
                    primary
                  >
                    Start League Night
                  </PBKButton>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PBKButton href="/admin/players">
                  Manage Weekly Roster
                </PBKButton>

                <PBKButton href="/display">
                  Club Standings
                </PBKButton>

                <PBKButton href="/history">
                  History
                </PBKButton>
              </section>
            </>
          )}
      </div>
    </AppLayout>
  );
}

function DashboardCard({
  title,
  value,
  valueClassName = "text-white",
}: {
  title: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <p
        className={`mt-2 text-3xl font-black ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}