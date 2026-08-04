"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useLeague } from "@/components/providers/LeagueProvider";
import {
  getMatchCenter,
  type MatchCenterCourt,
  type MatchCenterData,
} from "@/lib/data/matchCenter";

function formatDifferential(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function getCourtStatus(court: MatchCenterCourt) {
  if (court.complete) {
    return "Final";
  }

  if (
    court.team1.length === 2 &&
    court.team2.length === 2
  ) {
    return "Playing";
  }

  return "Waiting";
}

function getCourtGridClass(courtCount: number) {
  if (courtCount <= 2) {
    return "grid-cols-1 sm:grid-cols-2";
  }

  if (courtCount <= 4) {
    return "grid-cols-2";
  }

  if (courtCount <= 6) {
    return "grid-cols-2 lg:grid-cols-3";
  }

  if (courtCount <= 9) {
    return "grid-cols-3";
  }

  return "grid-cols-3 2xl:grid-cols-4";
}

function getStandingsColumnCount(playerCount: number) {
  if (playerCount > 32) {
    return 3;
  }

  if (playerCount > 16) {
    return 2;
  }

  return 1;
}

export default function TVPage() {
  const { activeEvent } = useLeague();

  const [matchCenter, setMatchCenter] =
    useState<MatchCenterData | null>(null);

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const eventId = activeEvent?.id ?? "";

  const loadTVData = useCallback(
    async (showLoading = false) => {
      if (!eventId) {
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }

        const data = await getMatchCenter(eventId);

        setMatchCenter(data);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the TV display.",
        );
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (!eventId) {
      return;
    }

    void loadTVData(true);

    const intervalId = window.setInterval(() => {
      void loadTVData(false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [eventId, loadTVData]);

  const completedCourtCount = useMemo(
    () =>
      matchCenter?.courts.filter(
        (court) => court.complete,
      ).length ?? 0,
    [matchCenter],
  );

  const standingsColumns = useMemo(() => {
    const standings = matchCenter?.standings ?? [];
    const columnCount = getStandingsColumnCount(
      standings.length,
    );

    const rowsPerColumn = Math.ceil(
      standings.length / columnCount,
    );

    return Array.from(
      { length: columnCount },
      (_, columnIndex) =>
        standings.slice(
          columnIndex * rowsPerColumn,
          (columnIndex + 1) * rowsPerColumn,
        ),
    );
  }, [matchCenter]);

  if (!activeEvent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-white">
        <div className="max-w-lg rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-8 text-center">
          <div className="text-5xl">🏓</div>

          <h1 className="mt-4 text-3xl font-bold text-yellow-400">
            No Active League Event
          </h1>

          <p className="mt-3 text-zinc-300">
            Open Admin and resume or start a league
            night first.
          </p>

          <Link
            href="/admin"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-500"
          >
            Open Admin
          </Link>
        </div>
      </main>
    );
  }

  if (isLoading && !matchCenter) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="text-xl font-semibold text-blue-300">
          Loading live courts and standings...
        </p>
      </main>
    );
  }

  if (errorMessage && !matchCenter) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-white">
        <div className="max-w-lg rounded-2xl border border-red-500/40 bg-red-500/10 p-8 text-center">
          <h1 className="text-3xl font-bold text-red-300">
            Unable to Load TV Display
          </h1>

          <p className="mt-3 text-red-200">
            {errorMessage}
          </p>
        </div>
      </main>
    );
  }

  if (!matchCenter) {
    return null;
  }

  const courtGridClass = getCourtGridClass(
    matchCenter.courts.length,
  );

  const sessionLabel = activeEvent.session_note
    ? `Session ${activeEvent.session_number} — ${activeEvent.session_note}`
    : `Session ${activeEvent.session_number}`;

  return (
    <main className="h-screen overflow-hidden bg-zinc-950 p-2 text-white">
      <div className="flex h-full flex-col gap-2">
        <header className="flex shrink-0 items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-400">
              Pickleball Kingdom
            </p>

            <div className="mt-0.5 flex min-w-0 items-baseline gap-3">
              <h1 className="truncate text-lg font-black text-yellow-400">
                {matchCenter.event.name}
              </h1>

              <span className="shrink-0 text-xs font-semibold text-zinc-400">
                {sessionLabel}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-md bg-zinc-800 px-3 py-1 text-center">
              <p className="text-[9px] uppercase tracking-wide text-zinc-500">
                Round
              </p>
              <p className="text-xl font-black leading-none text-white">
                {matchCenter.round.round_number}
              </p>
            </div>

            <div className="rounded-md bg-zinc-800 px-3 py-1 text-center">
              <p className="text-[9px] uppercase tracking-wide text-zinc-500">
                Complete
              </p>
              <p className="text-xl font-black leading-none text-white">
                {completedCourtCount}/
                {matchCenter.courts.length}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                matchCenter.roundComplete
                  ? "bg-green-500/20 text-green-300"
                  : "bg-blue-500/20 text-blue-300"
              }`}
            >
              {matchCenter.roundComplete
                ? "Round Complete"
                : "Live"}
            </span>
          </div>
        </header>

        {errorMessage && (
          <div className="shrink-0 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300">
            Refresh temporarily failed: {errorMessage}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(460px,1fr)]">
          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="mb-1 flex shrink-0 items-center justify-between px-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                Current Matches
              </h2>

              <span className="text-[10px] text-zinc-500">
                Updates every 3 seconds
              </span>
            </div>

            <div
              className={`grid min-h-0 flex-1 auto-rows-fr gap-1.5 ${courtGridClass}`}
            >
              {matchCenter.courts.map((court) => {
                const teamsReady =
                  court.team1.length === 2 &&
                  court.team2.length === 2;

                const status = getCourtStatus(court);

                return (
                  <article
                    key={court.databaseCourtId}
                    className="flex min-h-0 flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-900"
                  >
                    <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-2.5 py-1">
                      <h3 className="text-xs font-black text-yellow-400">
                        Court {court.courtNumber}
                      </h3>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          court.complete
                            ? "bg-green-500/15 text-green-300"
                            : teamsReady
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-yellow-500/15 text-yellow-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            court.complete
                              ? "bg-green-400"
                              : teamsReady
                                ? "bg-blue-400"
                                : "bg-yellow-400"
                          }`}
                        />
                        {status}
                      </span>
                    </header>

                    {!teamsReady ? (
                      <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-2 text-center">
                        <div>
                          <p className="text-xs font-bold text-yellow-300">
                            Pairing Pending
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            Confirm in Runner Mode
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-h-0 flex-1 grid-rows-2 divide-y divide-zinc-800">
                        <div
                          className={`grid min-h-0 grid-cols-[minmax(0,1fr)_38px] items-center gap-1.5 px-2.5 py-1 ${
                            court.complete &&
                            court.winnerTeam === 1
                              ? "bg-green-500/10"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            {court.team1.map((player) => (
                              <p
                                key={player.playerId}
                                className={`truncate text-[11px] font-semibold leading-tight ${
                                  court.complete &&
                                  court.winnerTeam !== 1
                                    ? "text-zinc-500"
                                    : "text-white"
                                }`}
                              >
                                {player.name}
                              </p>
                            ))}
                          </div>

                          <div className="text-right text-xl font-black leading-none text-blue-300">
                            {court.team1Score ?? "—"}
                          </div>
                        </div>

                        <div
                          className={`grid min-h-0 grid-cols-[minmax(0,1fr)_38px] items-center gap-1.5 px-2.5 py-1 ${
                            court.complete &&
                            court.winnerTeam === 2
                              ? "bg-green-500/10"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            {court.team2.map((player) => (
                              <p
                                key={player.playerId}
                                className={`truncate text-[11px] font-semibold leading-tight ${
                                  court.complete &&
                                  court.winnerTeam !== 2
                                    ? "text-zinc-500"
                                    : "text-white"
                                }`}
                              >
                                {player.name}
                              </p>
                            ))}
                          </div>

                          <div className="text-right text-xl font-black leading-none text-yellow-300">
                            {court.team2Score ?? "—"}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="mb-1 flex shrink-0 items-center justify-between px-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                Live Standings
              </h2>

              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-bold text-green-300">
                Auto Refresh
              </span>
            </div>

            {matchCenter.standings.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-400">
                Standings will appear after the first
                completed match.
              </div>
            ) : (
              <div
                className="grid min-h-0 flex-1 gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${standingsColumns.length}, minmax(0, 1fr))`,
                }}
              >
                {standingsColumns.map(
                  (standings, columnIndex) => (
                    <div
                      key={columnIndex}
                      className="min-h-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900"
                    >
                      <table className="h-full w-full table-fixed border-collapse text-[10px]">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-800/70 text-zinc-400">
                            <th className="w-6 px-1 py-1 text-left">
                              #
                            </th>
                            <th className="px-1 py-1 text-left">
                              Player
                            </th>
                            <th className="w-6 px-1 py-1 text-center">
                              W
                            </th>
                            <th className="w-6 px-1 py-1 text-center">
                              L
                            </th>
                            <th className="w-9 px-1 py-1 text-right">
                              +/-
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {standings.map((standing) => (
                            <tr
                              key={standing.playerId}
                              className="border-b border-zinc-800 last:border-0"
                            >
                              <td className="px-1 py-0.5 font-black text-yellow-400">
                                {standing.rank}
                              </td>

                              <td className="truncate px-1 py-0.5 font-semibold text-white">
                                {standing.name}
                              </td>

                              <td className="px-1 py-0.5 text-center font-bold text-green-400">
                                {standing.wins}
                              </td>

                              <td className="px-1 py-0.5 text-center font-bold text-red-400">
                                {standing.losses}
                              </td>

                              <td
                                className={`px-1 py-0.5 text-right font-bold ${
                                  standing.pointDifferential > 0
                                    ? "text-green-400"
                                    : standing.pointDifferential < 0
                                      ? "text-red-400"
                                      : "text-zinc-400"
                                }`}
                              >
                                {formatDifferential(
                                  standing.pointDifferential,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}