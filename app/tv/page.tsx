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

function getStandingsColumnCount(playerCount: number) {
  if (playerCount > 24) {
    return 2;
  }

  return 1;
}

export default function TVPage() {
  const [leagues, setLeagues] =
    useState<LeagueRecord[]>([]);

  const [seasons, setSeasons] =
    useState<SeasonRecord[]>([]);

  const [selectedLeagueId, setSelectedLeagueId] =
    useState("");

  const [selectedSeasonId, setSelectedSeasonId] =
    useState("");

  const [selectedEvent, setSelectedEvent] =
    useState<LeagueEventRecord | null>(null);

  const [matchCenter, setMatchCenter] =
    useState<MatchCenterData | null>(null);

  const [isLoadingSelections, setIsLoadingSelections] =
    useState(true);

  const [isLoadingDisplay, setIsLoadingDisplay] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

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
              league.id === storedLeagueId,
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
              season.id === storedSeasonId,
          ) ??
          seasonData.find(
            (season) =>
              season.status === "active",
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

  const eventId = selectedEvent?.id ?? "";

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

  const completedCourtCount = useMemo(
    () =>
      matchCenter?.courts.filter(
        (court) => court.complete,
      ).length ?? 0,
    [matchCenter],
  );

  const standingsColumns = useMemo(() => {
  const standings =
    matchCenter?.standings ?? [];

  return [
    standings.slice(0, 16),
    standings.slice(16, 32),
    standings.slice(32, 48),
  ];
}, [matchCenter]);
  const selectedLeague =
    leagues.find(
      (league) =>
        league.id === selectedLeagueId,
    ) ?? null;

  const selectedSeason =
    seasons.find(
      (season) =>
        season.id === selectedSeasonId,
    ) ?? null;

  const sessionNumber =
    selectedEvent?.session_number ?? 1;

  const sessionLabel =
    selectedEvent?.session_note
      ? `Session ${sessionNumber} — ${selectedEvent.session_note}`
      : `Session ${sessionNumber}`;

  return (
    <main className="h-screen overflow-hidden bg-zinc-950 p-2 text-white">
      <div className="flex h-full flex-col gap-2">
        <header className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-400">
                Pickleball Kingdom
              </p>

              <div className="mt-0.5 flex min-w-0 items-baseline gap-3">
                <h1 className="truncate text-lg font-black text-yellow-400">
                  {matchCenter?.event.name ??
                    selectedEvent?.name ??
                    "League TV"}
                </h1>

                {selectedEvent && (
                  <span className="shrink-0 text-xs font-semibold text-zinc-400">
                    {sessionLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <select
                value={selectedLeagueId}
                onChange={(event) =>
                  setSelectedLeagueId(
                    event.target.value,
                  )
                }
                aria-label="Select league"
                className="h-9 max-w-56 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs font-semibold text-white outline-none focus:border-blue-500"
              >
                {leagues.map((league) => (
                  <option
                    key={league.id}
                    value={league.id}
                  >
                    {league.name}
                  </option>
                ))}
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
                className="h-9 max-w-52 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs font-semibold text-white outline-none focus:border-blue-500 disabled:opacity-50"
              >
                {seasons.map((season) => (
                  <option
                    key={season.id}
                    value={season.id}
                  >
                    {season.name}
                  </option>
                ))}
              </select>

              {matchCenter && (
                <>
                  <div className="rounded-md bg-zinc-800 px-3 py-1 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-zinc-500">
                      Round
                    </p>
                    <p className="text-xl font-black leading-none text-white">
                      {
                        matchCenter.round
                          .round_number
                      }
                    </p>
                  </div>

                  <div className="rounded-md bg-zinc-800 px-3 py-1 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-zinc-500">
                      Complete
                    </p>
                    <p className="text-xl font-black leading-none text-white">
                      {completedCourtCount}/
                      {
                        matchCenter.courts
                          .length
                      }
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
                </>
              )}
            </div>
          </div>

          {(selectedLeague ||
            selectedSeason) && (
            <p className="mt-1 text-[10px] text-zinc-500">
              {selectedLeague?.name ??
                "League"}
              {selectedSeason
                ? ` · ${selectedSeason.name}`
                : ""}
            </p>
          )}
        </header>

        {errorMessage && (
          <div className="shrink-0 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300">
            {errorMessage}
          </div>
        )}

        {(isLoadingSelections ||
          isLoadingDisplay) &&
        !matchCenter ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
            <p className="text-lg font-semibold text-blue-300">
              Loading selected league...
            </p>
          </div>
        ) : !selectedEvent ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-8 text-center">
            <div>
              <h2 className="text-2xl font-bold text-yellow-300">
                No active event for this
                league and season
              </h2>

              <p className="mt-2 text-zinc-300">
                Choose another league or
                season, or start the session
                in Admin.
              </p>

              <Link
                href="/admin"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 font-semibold text-white"
              >
                Open Admin
              </Link>
            </div>
          </div>
        ) : !matchCenter ? null : (
          <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(360px,0.72fr)_minmax(0,1.75fr)]">
            <section className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-1 flex shrink-0 items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                  Courts
                </h2>

                <span className="text-[10px] text-zinc-500">
                  Updates every 3 seconds
                </span>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-2 auto-rows-fr gap-1.5">
                {matchCenter.courts.map(
                  (court) => {
                    const teamsReady =
                      court.team1.length ===
                        2 &&
                      court.team2.length ===
                        2;

                    const status =
                      getCourtStatus(court);

                    return (
                      <article
                        key={
                          court.databaseCourtId
                        }
                        className="flex min-h-0 flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-900"
                      >
                        <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-2 py-1">
                          <h3 className="text-xs font-black text-yellow-400">
                            Court{" "}
                            {
                              court.courtNumber
                            }
                          </h3>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              court.complete
                                ? "bg-green-500/15 text-green-300"
                                : teamsReady
                                  ? "bg-blue-500/15 text-blue-300"
                                  : "bg-yellow-500/15 text-yellow-300"
                            }`}
                          >
                            {status}
                          </span>
                        </header>

                        {!teamsReady ? (
                          <div className="flex min-h-0 flex-1 items-center justify-center px-2 text-center">
                            <p className="text-[10px] font-semibold text-yellow-300">
                              Pairing Pending
                            </p>
                          </div>
                        ) : (
                          <div className="grid min-h-0 flex-1 grid-rows-2 divide-y divide-zinc-800">
                            <div
                              className={`grid grid-cols-[minmax(0,1fr)_30px] items-center gap-1 px-2 py-1 ${
                                court.complete &&
                                court.winnerTeam ===
                                  1
                                  ? "bg-green-500/10"
                                  : ""
                              }`}
                            >
                              <div className="min-w-0">
                                {court.team1.map(
                                  (player) => (
                                    <p
                                      key={
                                        player.playerId
                                      }
                                      className="truncate text-[10px] font-semibold leading-tight"
                                    >
                                      {
                                        player.name
                                      }
                                    </p>
                                  ),
                                )}
                              </div>

                              <span className="text-right text-lg font-black text-blue-300">
                                {court.team1Score ??
                                  "—"}
                              </span>
                            </div>

                            <div
                              className={`grid grid-cols-[minmax(0,1fr)_30px] items-center gap-1 px-2 py-1 ${
                                court.complete &&
                                court.winnerTeam ===
                                  2
                                  ? "bg-green-500/10"
                                  : ""
                              }`}
                            >
                              <div className="min-w-0">
                                {court.team2.map(
                                  (player) => (
                                    <p
                                      key={
                                        player.playerId
                                      }
                                      className="truncate text-[10px] font-semibold leading-tight"
                                    >
                                      {
                                        player.name
                                      }
                                    </p>
                                  ),
                                )}
                              </div>

                              <span className="text-right text-lg font-black text-yellow-300">
                                {court.team2Score ??
                                  "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  },
                )}
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-1 flex shrink-0 items-center justify-between px-1">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-200">
                    Live Standings
                  </h2>
                  <p className="text-[10px] text-zinc-500">
                    Only the selected active
                    league event
                  </p>
                </div>

                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-300">
                  Auto Refresh
                </span>
              </div>

              {matchCenter.standings.length ===
              0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 p-6 text-center text-base text-zinc-400">
                  Standings will appear after
                  the first completed match.
                </div>
              ) : (
                <div
                  className="grid min-h-0 flex-1 gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${standingsColumns.length}, minmax(0, 1fr))`,
                  }}
                >
                  {standingsColumns.map(
                    (
                      standings,
                      columnIndex,
                    ) => (
                      <div
                        key={columnIndex}
                        className="min-h-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900"
                      >
                        <table className="h-full w-full table-fixed border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-zinc-700 bg-zinc-800/80 text-zinc-300">
                              <th className="w-10 px-2 py-2 text-left">
                                #
                              </th>
                              <th className="px-2 py-2 text-left">
                                Player
                              </th>
                              <th className="w-11 px-2 py-2 text-center">
                                W
                              </th>
                              <th className="w-11 px-2 py-2 text-center">
                                L
                              </th>
                              <th className="w-14 px-2 py-2 text-right">
                                +/-
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {standings.map(
                              (standing) => (
                                <tr
                                  key={
                                    standing.playerId
                                  }
                                  className="border-b border-zinc-800 last:border-0"
                                >
                                  <td className="px-2 py-1.5 text-base font-black text-yellow-400">
                                    {
                                      standing.rank
                                    }
                                  </td>

                                  <td className="truncate px-2 py-1.5 text-base font-bold text-white">
                                    {
                                      standing.name
                                    }
                                  </td>

                                  <td className="px-2 py-1.5 text-center text-base font-black text-green-400">
                                    {
                                      standing.wins
                                    }
                                  </td>

                                  <td className="px-2 py-1.5 text-center text-base font-black text-red-400">
                                    {
                                      standing.losses
                                    }
                                  </td>

                                  <td
                                    className={`px-2 py-1.5 text-right text-base font-black ${
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
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}