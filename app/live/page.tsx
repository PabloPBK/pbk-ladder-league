"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import {
  getActiveLeagueEvent,
  type LeagueEventRecord,
} from "@/lib/data/events";
import {
  getMatchCenter,
  type MatchCenterData,
} from "@/lib/data/matchCenter";

function formatDifferential(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

export default function LivePage() {
  const [activeEvent, setActiveEvent] =
    useState<LeagueEventRecord | null>(null);

  const [matchCenter, setMatchCenter] =
    useState<MatchCenterData | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadLiveData = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) {
          setIsLoading(true);
        }

        const event =
          await getActiveLeagueEvent();

        if (!event) {
          setActiveEvent(null);
          setMatchCenter(null);
          setErrorMessage("");
          return;
        }

        const data =
          await getMatchCenter(event.id);

        setActiveEvent(event);
        setMatchCenter(data);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load live standings.",
        );
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadLiveData(true);

    const intervalId = window.setInterval(() => {
      void loadLiveData(false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadLiveData]);

  const completedCourtCount = useMemo(
    () =>
      matchCenter?.courts.filter(
        (court) => court.complete,
      ).length ?? 0,
    [matchCenter],
  );

  if (isLoading && !matchCenter) {
    return (
      <AppLayout
        title="Live Standings"
        description="Loading the current league night."
      >
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-blue-500/30 bg-blue-500/10 p-10 text-center">
          <p className="text-2xl font-semibold text-blue-300">
            Loading live standings...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!activeEvent && !errorMessage) {
    return (
      <AppLayout
        title="Live Standings"
        description="Waiting for an active league night."
      >
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <div className="max-w-xl">
            <div className="text-7xl">🏓</div>

            <h2 className="mt-6 text-4xl font-bold text-yellow-400">
              No Active League Event
            </h2>

            <p className="mt-4 text-xl text-zinc-400">
              Create or restore a league night from the
              Admin page.
            </p>

            <Link
              href="/admin"
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-xl bg-blue-600 px-7 py-4 text-lg font-semibold text-white transition hover:bg-blue-500"
            >
              Open Admin
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (errorMessage && !matchCenter) {
    return (
      <AppLayout
        title="Live Standings"
        description="Unable to load the active league night."
      >
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-red-500/40 bg-red-500/10 p-10 text-center">
          <div className="max-w-xl">
            <h2 className="text-4xl font-bold text-red-300">
              Unable to Load Live Standings
            </h2>

            <p className="mt-4 text-xl text-red-200">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadLiveData(true)
              }
              className="mt-8 min-h-14 rounded-xl bg-blue-600 px-7 py-4 text-lg font-semibold text-white transition hover:bg-blue-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!matchCenter) {
    return null;
  }

  return (
    <AppLayout
      title={`Round ${matchCenter.round.round_number} Live Standings`}
      description={`${completedCourtCount} of ${matchCenter.courts.length} courts complete • Updates automatically every 3 seconds`}
    >
      <div className="mx-auto max-w-7xl">
        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-300">
            Live refresh temporarily failed:{" "}
            {errorMessage}
          </div>
        )}

        <section className="mb-8 rounded-3xl border border-blue-500/40 bg-blue-500/10 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
                Active League Event
              </p>

              <h2 className="mt-2 text-3xl font-bold text-white">
                {matchCenter.event.name}
              </h2>

              <p className="mt-2 text-lg text-zinc-300">
                Round{" "}
                {matchCenter.round.round_number}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="rounded-full bg-green-500/15 px-5 py-2 font-semibold text-green-300">
                Live
              </span>

              <span className="rounded-full bg-zinc-900 px-5 py-2 font-semibold text-zinc-300">
                {completedCourtCount} /{" "}
                {matchCenter.courts.length} Courts
              </span>

              {matchCenter.roundComplete && (
                <span className="rounded-full bg-green-500/20 px-5 py-2 font-semibold text-green-300">
                  Round Complete
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
          <section>
            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 px-6 py-5">
                <h2 className="text-3xl font-bold text-white">
                  Season Standings
                </h2>

                <p className="mt-1 text-zinc-400">
                  Ranked by wins, point differential,
                  and points scored.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-zinc-800/80">
                    <tr className="text-left text-sm uppercase tracking-wide text-zinc-400">
                      <th className="px-5 py-4">
                        Rank
                      </th>

                      <th className="px-5 py-4">
                        Player
                      </th>

                      <th className="px-5 py-4 text-center">
                        GP
                      </th>

                      <th className="px-5 py-4 text-center">
                        W
                      </th>

                      <th className="px-5 py-4 text-center">
                        L
                      </th>

                      <th className="px-5 py-4 text-center">
                        PF
                      </th>

                      <th className="px-5 py-4 text-center">
                        PA
                      </th>

                      <th className="px-5 py-4 text-center">
                        +/-
                      </th>

                      <th className="px-5 py-4 text-center">
                        DUPR
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {matchCenter.standings.map(
                      (standing) => (
                        <tr
                          key={standing.playerId}
                          className="border-t border-zinc-800"
                        >
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-lg font-black ${
                                standing.rank === 1
                                  ? "bg-yellow-400 text-black"
                                  : standing.rank === 2
                                    ? "bg-zinc-300 text-black"
                                    : standing.rank === 3
                                      ? "bg-amber-700 text-white"
                                      : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {standing.rank}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-xl font-bold text-white">
                              {standing.name}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-center text-zinc-300">
                            {standing.gamesPlayed}
                          </td>

                          <td className="px-5 py-4 text-center text-xl font-bold text-green-400">
                            {standing.wins}
                          </td>

                          <td className="px-5 py-4 text-center text-xl font-bold text-red-400">
                            {standing.losses}
                          </td>

                          <td className="px-5 py-4 text-center">
                            {standing.pointsFor}
                          </td>

                          <td className="px-5 py-4 text-center">
                            {standing.pointsAgainst}
                          </td>

                          <td
                            className={`px-5 py-4 text-center text-lg font-bold ${
                              standing.pointDifferential >
                              0
                                ? "text-green-400"
                                : standing.pointDifferential <
                                    0
                                  ? "text-red-400"
                                  : "text-zinc-400"
                            }`}
                          >
                            {formatDifferential(
                              standing.pointDifferential,
                            )}
                          </td>

                          <td className="px-5 py-4 text-center text-blue-400">
                            {standing.dupr.toFixed(2)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {matchCenter.standings.length ===
                0 && (
                <div className="p-10 text-center text-lg text-zinc-400">
                  Standings will appear after the
                  first completed court.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="sticky top-6">
              <div className="mb-5">
                <h2 className="text-3xl font-bold text-white">
                  Current Round
                </h2>

                <p className="mt-1 text-zinc-400">
                  Live court results
                </p>
              </div>

              <div className="space-y-4">
                {matchCenter.courts.map((court) => {
                  const teamsReady =
                    court.team1.length === 2 &&
                    court.team2.length === 2;

                  return (
                    <article
                      key={court.databaseCourtId}
                      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                    >
                      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
                        <h3 className="text-2xl font-bold text-yellow-400">
                          Court {court.courtNumber}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            court.complete
                              ? "bg-green-500/15 text-green-300"
                              : teamsReady
                                ? "bg-blue-500/15 text-blue-300"
                                : "bg-yellow-500/15 text-yellow-300"
                          }`}
                        >
                          {court.complete
                            ? "Final"
                            : teamsReady
                              ? "In Progress"
                              : "Pairing Pending"}
                        </span>
                      </header>

                      {!teamsReady ? (
                        <div className="p-5 text-center text-zinc-400">
                          Waiting for teams to be
                          confirmed.
                        </div>
                      ) : (
                        <div className="p-5">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            <div className="rounded-xl bg-blue-500/10 p-4 text-center">
                              {court.team1.map(
                                (player) => (
                                  <p
                                    key={
                                      player.playerId
                                    }
                                    className="mt-1 font-bold text-white"
                                  >
                                    {player.name}
                                  </p>
                                ),
                              )}

                              {court.team1Score !==
                                null && (
                                <p className="mt-4 text-4xl font-black text-blue-300">
                                  {
                                    court.team1Score
                                  }
                                </p>
                              )}
                            </div>

                            <div className="font-black text-zinc-500">
                              VS
                            </div>

                            <div className="rounded-xl bg-yellow-500/10 p-4 text-center">
                              {court.team2.map(
                                (player) => (
                                  <p
                                    key={
                                      player.playerId
                                    }
                                    className="mt-1 font-bold text-white"
                                  >
                                    {player.name}
                                  </p>
                                ),
                              )}

                              {court.team2Score !==
                                null && (
                                <p className="mt-4 text-4xl font-black text-yellow-300">
                                  {
                                    court.team2Score
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}