"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import {
  getHistoryEvent,
  type HistoryEventDetail,
} from "@/lib/data/history";

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatDifferential(value: number) {
  return value > 0
    ? `+${value}`
    : String(value);
}

export default function HistoryDetailPage() {
  const params = useParams<{
    eventId: string;
  }>();

  const eventId = params.eventId;

  const [history, setHistory] =
    useState<HistoryEventDetail | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let cancelled = false;

    async function loadHistoryEvent() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const result =
          await getHistoryEvent(eventId);

        if (!cancelled) {
          setHistory(result);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load this league night.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHistoryEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (isLoading) {
    return (
      <AppLayout
        title="League Night History"
        description="Loading completed results."
      >
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-8 text-center text-blue-300">
          Loading league-night results...
        </div>
      </AppLayout>
    );
  }

  if (errorMessage || !history) {
    return (
      <AppLayout
        title="League Night History"
        description="Unable to load this event."
      >
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-8 text-center">
          <p className="text-xl text-red-300">
            {errorMessage ||
              "Unable to load this event."}
          </p>

          <Link
            href="/history"
            className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-6 font-semibold text-white"
          >
            Back to History
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={history.event.name}
      description={formatEventDate(
        history.event.eventDate,
      )}
    >
      <div className="mx-auto max-w-7xl">
        <Link
          href="/history"
          className="mb-6 inline-flex text-blue-400 transition hover:text-blue-300"
        >
          ← Back to League History
        </Link>

        <section className="mb-8 rounded-3xl border border-purple-500/40 bg-purple-500/10 p-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-purple-300">
            Completed League Night
          </p>

          <h2 className="mt-2 text-4xl font-bold text-white">
            {history.event.name}
          </h2>

          <p className="mt-3 text-xl text-zinc-300">
            {formatEventDate(
              history.event.eventDate,
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-zinc-900 px-4 py-2 text-zinc-300">
              {history.event.playerCount}{" "}
              Players
            </span>

            <span className="rounded-full bg-zinc-900 px-4 py-2 text-zinc-300">
              {history.event.roundCount}{" "}
              Rounds
            </span>
          </div>
        </section>

        <section className="mb-10 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-6">
            <h2 className="text-3xl font-bold text-white">
              Final Standings
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-zinc-800">
                <tr className="text-left text-sm uppercase tracking-wide text-zinc-400">
                  <th className="px-5 py-4">
                    #
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
                </tr>
              </thead>

              <tbody>
                {history.standings.map(
                  (standing) => (
                    <tr
                      key={standing.playerId}
                      className="border-t border-zinc-800"
                    >
                      <td className="px-5 py-4 text-xl font-black text-yellow-400">
                        {standing.rank}
                      </td>

                      <td className="px-5 py-4 font-bold text-white">
                        {standing.name}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {standing.gamesPlayed}
                      </td>

                      <td className="px-5 py-4 text-center font-bold text-green-400">
                        {standing.wins}
                      </td>

                      <td className="px-5 py-4 text-center font-bold text-red-400">
                        {standing.losses}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {standing.pointsFor}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {standing.pointsAgainst}
                      </td>

                      <td className="px-5 py-4 text-center font-bold">
                        {formatDifferential(
                          standing.pointDifferential,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-10">
          {history.rounds.map((round) => (
            <section key={round.id}>
              <h2 className="mb-5 text-3xl font-bold text-white">
                Round {round.roundNumber}
              </h2>

              <div className="grid gap-5 lg:grid-cols-2">
                {round.courts.map((court) => (
                  <article
                    key={court.databaseCourtId}
                    className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                  >
                    <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                      <h3 className="text-2xl font-bold text-yellow-400">
                        Court {court.courtNumber}
                      </h3>

                      <span className="rounded-full bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-300">
                        Final
                      </span>
                    </header>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-5">
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

                        <p className="mt-4 text-4xl font-black text-blue-300">
                          {court.team1Score ??
                            "—"}
                        </p>
                      </div>

                      <span className="font-black text-zinc-500">
                        VS
                      </span>

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

                        <p className="mt-4 text-4xl font-black text-yellow-300">
                          {court.team2Score ??
                            "—"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}