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
  return value > 0 ? `+${value}` : String(value);
}

export default function TVPage() {
  const [leagues, setLeagues] = useState<
    LeagueRecord[]
  >([]);

  const [seasons, setSeasons] = useState<
    SeasonRecord[]
  >([]);

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

  const [matchCenter, setMatchCenter] =
    useState<MatchCenterData | null>(null);

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
   * Load available leagues.
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

  /*
   * Load seasons when the league changes.
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

  /*
   * Find the active event/session for the
   * selected league and season.
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
   * Load current-session standings.
   *
   * Match Center now returns standings for
   * only the selected active league event.
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
   * Refresh the TV automatically every
   * three seconds.
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

  /*
   * Current round completion count is still
   * useful in the compact header even though
   * court cards are no longer displayed.
   */
  const completedCourtCount = useMemo(
    () =>
      matchCenter?.courts.filter(
        (court) => court.complete,
      ).length ?? 0,
    [matchCenter],
  );

  /*
   * Up to 48 players:
   *
   * Column 1 = 1–16
   * Column 2 = 17–32
   * Column 3 = 33–48
   */
  const standingsColumns =
    useMemo(() => {
      const standings =
        matchCenter?.standings ?? [];

      return [
        standings.slice(0, 16),
        standings.slice(16, 32),
        standings.slice(32, 48),
      ].filter(
        (column) => column.length > 0,
      );
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
        {/* TOP STATUS BAR */}
        <header className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-400">
                Pickleball Kingdom
              </p>

              <div className="mt-0.5 flex min-w-0 items-baseline gap-3">
                <h1 className="truncate text-xl font-black text-yellow-400">
                  {matchCenter?.event.name ??
                    selectedEvent?.name ??
                    "League TV"}
                </h1>

                {selectedEvent && (
                  <span className="shrink-0 text-sm font-semibold text-zinc-400">
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

        {/* ERROR */}
        {errorMessage && (
          <div className="shrink-0 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300">
            {errorMessage}
          </div>
        )}

        {/* LOADING */}
        {(isLoadingSelections ||
          isLoadingDisplay) &&
        !matchCenter ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
            <p className="text-lg font-semibold text-blue-300">
              Loading selected league...
            </p>
          </div>
        ) : !selectedEvent ? (
          /*
           * NO ACTIVE SESSION
           */
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
          /*
           * STANDINGS ONLY
           */
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex shrink-0 items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-black uppercase tracking-[0.18em] text-zinc-100">
                  Live Standings
                </h2>

                <p className="text-xs text-zinc-500">
                  Current session only
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-300">
                  Auto Refresh · 3 sec
                </span>

                <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-300">
                  {
                    matchCenter.standings
                      .length
                  }{" "}
                  Players
                </span>
              </div>
            </div>

            {matchCenter.standings.length ===
            0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 p-6 text-center text-lg text-zinc-400">
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
                      className="min-h-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
                    >
                      <table className="h-full w-full table-fixed border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-700 bg-zinc-800/80 text-zinc-300">
                            <th className="w-12 px-3 py-2 text-left text-sm">
                              #
                            </th>

                            <th className="px-3 py-2 text-left text-sm">
                              Player
                            </th>

                            <th className="w-12 px-2 py-2 text-center text-sm">
                              W
                            </th>

                            <th className="w-12 px-2 py-2 text-center text-sm">
                              L
                            </th>

                            <th className="w-16 px-3 py-2 text-right text-sm">
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
                                <td className="px-3 py-1.5 text-lg font-black text-yellow-400">
                                  {
                                    standing.rank
                                  }
                                </td>

                                <td className="truncate px-3 py-1.5 text-lg font-bold text-white">
                                  {
                                    standing.name
                                  }
                                </td>

                                <td className="px-2 py-1.5 text-center text-lg font-black text-green-400">
                                  {
                                    standing.wins
                                  }
                                </td>

                                <td className="px-2 py-1.5 text-center text-lg font-black text-red-400">
                                  {
                                    standing.losses
                                  }
                                </td>

                                <td
                                  className={`px-3 py-1.5 text-right text-lg font-black ${
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
        )}
      </div>
    </main>
  );
}