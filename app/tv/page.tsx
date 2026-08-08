"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getActiveLeagues,
  getSeasonsForLeague,
  type LeagueRecord,
  type SeasonRecord,
} from "@/lib/data/leagues";
import {
  getActiveLeagueEvent,
  type LeagueEventRecord,
} from "@/lib/data/events";
import {
  getMatchCenter,
  type MatchCenterData,
} from "@/lib/data/matchCenter";

function formatDifferential(value: number) {
  return value > 0
    ? `+${value}`
    : String(value);
}

export default function TVPage() {
  const [leagues, setLeagues] =
    useState<LeagueRecord[]>([]);

  const [seasons, setSeasons] =
    useState<SeasonRecord[]>([]);

  const [
    selectedLeagueId,
    setSelectedLeagueId,
  ] = useState("");

  const [
    selectedSeasonId,
    setSelectedSeasonId,
  ] = useState("");

  const [
    selectedEvent,
    setSelectedEvent,
  ] = useState<LeagueEventRecord | null>(
    null,
  );

  const [
    matchCenter,
    setMatchCenter,
  ] = useState<MatchCenterData | null>(
    null,
  );

  const [
    isLoadingSelections,
    setIsLoadingSelections,
  ] = useState(true);

  const [
    isLoadingDisplay,
    setIsLoadingDisplay,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
   * LOAD LEAGUES
   */
  useEffect(() => {
    let cancelled = false;

    async function loadLeagues() {
      try {
        setIsLoadingSelections(true);
        setErrorMessage("");

        const leagueData =
          await getActiveLeagues();

        if (cancelled) {
          return;
        }

        setLeagues(leagueData);

        const storedLeagueId =
          window.localStorage.getItem(
            "pbk-tv-league-id",
          );

        const initialLeague =
          leagueData.find(
            (league) =>
              league.id ===
              storedLeagueId,
          ) ?? leagueData[0];

        setSelectedLeagueId(
          initialLeague?.id ?? "",
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load leagues.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSelections(false);
        }
      }
    }

    void loadLeagues();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * LOAD SEASONS
   */
  useEffect(() => {
    if (!selectedLeagueId) {
      setSeasons([]);
      setSelectedSeasonId("");
      setSelectedEvent(null);
      setMatchCenter(null);
      return;
    }

    let cancelled = false;

    async function loadSeasons() {
      try {
        setIsLoadingSelections(true);
        setErrorMessage("");

        window.localStorage.setItem(
          "pbk-tv-league-id",
          selectedLeagueId,
        );

        const seasonData =
          await getSeasonsForLeague(
            selectedLeagueId,
          );

        if (cancelled) {
          return;
        }

        setSeasons(seasonData);

        const storedSeasonId =
          window.localStorage.getItem(
            `pbk-tv-season-id:${selectedLeagueId}`,
          );

        const activeSeason =
          seasonData.find(
            (season) =>
              season.id ===
              storedSeasonId,
          ) ??
          seasonData.find(
            (season) =>
              season.status ===
              "active",
          ) ??
          seasonData[0];

        setSelectedSeasonId(
          activeSeason?.id ?? "",
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load seasons.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSelections(false);
        }
      }
    }

    void loadSeasons();

    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId]);

  /*
   * LOAD ACTIVE SESSION
   */
  useEffect(() => {
    if (!selectedSeasonId) {
      setSelectedEvent(null);
      setMatchCenter(null);
      return;
    }

    let cancelled = false;

    async function loadActiveEvent() {
      try {
        setIsLoadingDisplay(true);
        setErrorMessage("");

        window.localStorage.setItem(
          `pbk-tv-season-id:${selectedLeagueId}`,
          selectedSeasonId,
        );

        const event =
          await getActiveLeagueEvent(
            selectedSeasonId,
          );

        if (cancelled) {
          return;
        }

        setSelectedEvent(event);
        setMatchCenter(null);
      } catch (error) {
        if (!cancelled) {
          setSelectedEvent(null);
          setMatchCenter(null);

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the active league event.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDisplay(false);
        }
      }
    }

    void loadActiveEvent();

    return () => {
      cancelled = true;
    };
  }, [
    selectedLeagueId,
    selectedSeasonId,
  ]);

  const eventId =
    selectedEvent?.id ?? "";

  /*
   * LOAD CURRENT SESSION STANDINGS
   */
  const loadTVData = useCallback(
    async (showLoading = false) => {
      if (!eventId) {
        return;
      }

      try {
        if (showLoading) {
          setIsLoadingDisplay(true);
        }

        const data =
          await getMatchCenter(eventId);

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
          setIsLoadingDisplay(false);
        }
      }
    },
    [eventId],
  );

  /*
   * AUTO REFRESH
   */
  useEffect(() => {
    if (!eventId) {
      return;
    }

    void loadTVData(true);

    const intervalId =
      window.setInterval(() => {
        void loadTVData(false);
      }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [eventId, loadTVData]);

  const completedCourtCount =
    useMemo(
      () =>
        matchCenter?.courts.filter(
          (court) =>
            court.complete,
        ).length ?? 0,
      [matchCenter],
    );

  /*
   * 48 PLAYERS
   *
   * Column 1 = 1–12
   * Column 2 = 13–24
   * Column 3 = 25–36
   * Column 4 = 37–48
   */
  const standingsColumns =
    useMemo(() => {
      const standings =
        matchCenter?.standings ?? [];

      return [
        standings.slice(0, 12),
        standings.slice(12, 24),
        standings.slice(24, 36),
        standings.slice(36, 48),
      ];
    }, [matchCenter]);

  const selectedLeague =
    leagues.find(
      (league) =>
        league.id ===
        selectedLeagueId,
    ) ?? null;

  const selectedSeason =
    seasons.find(
      (season) =>
        season.id ===
        selectedSeasonId,
    ) ?? null;

  const sessionNumber =
    selectedEvent?.session_number ??
    1;

  const sessionLabel =
    selectedEvent?.session_note
      ? `Session ${sessionNumber} — ${selectedEvent.session_note}`
      : `Session ${sessionNumber}`;

  return (
    <main className="h-[100dvh] overflow-hidden bg-zinc-950 p-1 text-white">
      <div className="flex h-full min-h-0 flex-col gap-1">
        {/* COMPACT HEADER */}
        <header className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="truncate text-base font-black leading-none text-yellow-400">
                  {matchCenter?.event.name ??
                    selectedEvent?.name ??
                    "League TV"}
                </h1>

                {selectedEvent && (
                  <span className="text-[10px] font-semibold text-zinc-400">
                    {sessionLabel}
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-[8px] leading-none text-zinc-500">
                {selectedLeague?.name ??
                  "League"}

                {selectedSeason
                  ? ` · ${selectedSeason.name}`
                  : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <select
                value={selectedLeagueId}
                onChange={(event) =>
                  setSelectedLeagueId(
                    event.target.value,
                  )
                }
                aria-label="Select league"
                className="h-6 max-w-44 rounded border border-zinc-700 bg-zinc-950 px-1 text-[10px] font-semibold text-white"
              >
                {leagues.map(
                  (league) => (
                    <option
                      key={league.id}
                      value={league.id}
                    >
                      {league.name}
                    </option>
                  ),
                )}
              </select>

              <select
                value={selectedSeasonId}
                onChange={(event) =>
                  setSelectedSeasonId(
                    event.target.value,
                  )
                }
                aria-label="Select season"
                disabled={
                  !selectedLeagueId ||
                  seasons.length === 0
                }
                className="h-6 max-w-36 rounded border border-zinc-700 bg-zinc-950 px-1 text-[10px] font-semibold text-white"
              >
                {seasons.map(
                  (season) => (
                    <option
                      key={season.id}
                      value={season.id}
                    >
                      {season.name}
                    </option>
                  ),
                )}
              </select>

              {matchCenter && (
                <>
                  <div className="rounded bg-zinc-800 px-2 py-0.5 text-center">
                    <p className="text-[6px] uppercase leading-none text-zinc-500">
                      Round
                    </p>

                    <p className="text-sm font-black leading-none">
                      {
                        matchCenter
                          .round
                          .round_number
                      }
                    </p>
                  </div>

                  <div className="rounded bg-zinc-800 px-2 py-0.5 text-center">
                    <p className="text-[6px] uppercase leading-none text-zinc-500">
                      Complete
                    </p>

                    <p className="text-sm font-black leading-none">
                      {completedCourtCount}/
                      {
                        matchCenter
                          .courts
                          .length
                      }
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      matchCenter.roundComplete
                        ? "bg-green-500/20 text-green-300"
                        : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {matchCenter.roundComplete
                      ? "Complete"
                      : "Live"}
                  </span>
                </>
              )}
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="shrink-0 rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[9px] text-yellow-300">
            {errorMessage}
          </div>
        )}

        {(isLoadingSelections ||
          isLoadingDisplay) &&
        !matchCenter ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            Loading...
          </div>
        ) : !selectedEvent ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-center">
            <div>
              <h2 className="text-xl font-bold text-yellow-300">
                No Active Session
              </h2>

              <Link
                href="/admin"
                className="mt-4 inline-flex rounded-lg bg-blue-600 px-5 py-2 font-semibold"
              >
                Open Admin
              </Link>
            </div>
          </div>
        ) : !matchCenter ? null : (
          <section className="flex min-h-0 flex-1 flex-col">
            {/* STANDINGS BAR */}
            <div className="flex shrink-0 items-center justify-between px-1 py-0.5">
              <div>
                <h2 className="text-xs font-black uppercase leading-none tracking-[0.15em]">
                  Live Standings
                </h2>

                <p className="mt-0.5 text-[8px] leading-none text-zinc-500">
                  Current session only
                </p>
              </div>

              <div className="flex gap-1">
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[8px] font-bold text-green-300">
                  Auto · 3 sec
                </span>

                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[8px] font-bold text-blue-300">
                  {
                    matchCenter
                      .standings
                      .length
                  }{" "}
                  Players
                </span>
              </div>
            </div>

            {matchCenter.standings.length ===
            0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center text-zinc-400">
                Waiting for results...
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-4 gap-1">
                {standingsColumns.map(
                  (
                    standings,
                    columnIndex,
                  ) => (
                    <div
                      key={columnIndex}
                      className="flex min-h-0 flex-col overflow-hidden rounded border border-zinc-800 bg-zinc-900"
                    >
                      {/* COLUMN HEADER */}
                      <div className="grid shrink-0 grid-cols-[30px_minmax(0,1fr)_30px_30px_42px] items-center border-b border-zinc-700 bg-zinc-800/80 px-1 py-1 text-[9px] font-bold leading-none text-zinc-300">
                        <div>#</div>

                        <div className="px-1">
                          Player
                        </div>

                        <div className="text-center">
                          W
                        </div>

                        <div className="text-center">
                          L
                        </div>

                        <div className="text-right">
                          +/-
                        </div>
                      </div>

                      {/* 12 EQUAL ROWS */}
                      <div
                        className="grid min-h-0 flex-1"
                        style={{
                          gridTemplateRows:
                            "repeat(12, minmax(0, 1fr))",
                        }}
                      >
                        {Array.from(
                          {
                            length: 12,
                          },
                          (_, rowIndex) => {
                            const standing =
                              standings[
                                rowIndex
                              ];

                            if (!standing) {
                              return (
                                <div
                                  key={`empty-${columnIndex}-${rowIndex}`}
                                  className="border-b border-zinc-800 last:border-0"
                                />
                              );
                            }

                            return (
                              <div
                                key={
                                  standing.playerId
                                }
                                className="grid min-h-0 grid-cols-[30px_minmax(0,1fr)_30px_30px_42px] items-center overflow-hidden border-b border-zinc-800 px-1 last:border-0"
                              >
                                <div className="text-xs font-black leading-none text-yellow-400">
                                  {
                                    standing.rank
                                  }
                                </div>

                                <div className="min-w-0 truncate px-1 text-xs font-bold leading-none text-white">
                                  {
                                    standing.name
                                  }
                                </div>

                                <div className="text-center text-xs font-black leading-none text-green-400">
                                  {
                                    standing.wins
                                  }
                                </div>

                                <div className="text-center text-xs font-black leading-none text-red-400">
                                  {
                                    standing.losses
                                  }
                                </div>

                                <div
                                  className={`text-right text-xs font-black leading-none ${
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
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}