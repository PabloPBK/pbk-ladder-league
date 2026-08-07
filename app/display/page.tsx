"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import {
  getActiveLeagues,
  getSeasonsForLeague,
  type LeagueRecord,
  type SeasonRecord,
} from "@/lib/data/leagues";
import { getSeasonStandings } from "@/lib/data/standings";
import type { SeasonStanding } from "@/lib/server/statistics";

function formatDifferential(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function getRankDisplay(rank: number) {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return String(rank);
}

export default function DisplayPage() {
  const [leagues, setLeagues] = useState<
    LeagueRecord[]
  >([]);

  const [seasons, setSeasons] = useState<
    SeasonRecord[]
  >([]);

  const [leagueId, setLeagueId] =
    useState("");

  const [seasonId, setSeasonId] =
    useState("");

  const [standings, setStandings] = useState<
    SeasonStanding[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * Load active leagues.
   */
  useEffect(() => {
    async function loadLeagues() {
      try {
        const leagueData =
          await getActiveLeagues();

        setLeagues(leagueData);

        if (leagueData.length > 0) {
          setLeagueId(
            leagueData[0].id,
          );
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load leagues.",
        );
      }
    }

    void loadLeagues();
  }, []);

  /*
   * Load seasons when league changes.
   */
  useEffect(() => {
    if (!leagueId) {
      setSeasons([]);
      setSeasonId("");
      return;
    }

    async function loadSeasons() {
      try {
        const seasonData =
          await getSeasonsForLeague(
            leagueId,
          );

        setSeasons(seasonData);

        if (seasonData.length > 0) {
          setSeasonId(
            seasonData[0].id,
          );
        } else {
          setSeasonId("");
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load seasons.",
        );
      }
    }

    void loadSeasons();
  }, [leagueId]);

  /*
   * Load cumulative season standings.
   * Refresh every 30 seconds.
   */
  useEffect(() => {
    if (!seasonId) {
      setStandings([]);
      return;
    }

    async function loadStandings(
      showLoading = false,
    ) {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const data =
          await getSeasonStandings(
            seasonId,
          );

        setStandings(data);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load standings.",
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    }

    void loadStandings(true);

    const timer = window.setInterval(
      () => {
        void loadStandings(false);
      },
      30000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [seasonId]);

  /*
   * TV display:
   * Top 30 players
   * 3 columns
   * 10 players per column.
   */
  const standingsColumns =
    useMemo(() => {
      const top30 =
        standings.slice(0, 30);

      return [
        top30.slice(0, 10),
        top30.slice(10, 20),
        top30.slice(20, 30),
      ];
    }, [standings]);

  return (
    <AppLayout
      title="Club Display"
      description="Live cumulative season standings."
    >
      <div className="space-y-4">
        {/* League + Season */}
        <div className="grid grid-cols-2 gap-3">
          <select
            value={leagueId}
            onChange={(event) => {
              setLeagueId(
                event.target.value,
              );
            }}
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-white"
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
            value={seasonId}
            onChange={(event) => {
              setSeasonId(
                event.target.value,
              );
            }}
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-white"
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
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-300">
            Loading standings...
          </div>
        ) : standings.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            No season standings available yet.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">
                  Season Leaderboard
                </h2>

                <p className="text-xs text-zinc-500">
                  Top 30 • Updates every
                  30 seconds
                </p>
              </div>

              <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-300">
                LIVE
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {standingsColumns.map(
                (
                  column,
                  columnIndex,
                ) => (
                  <div
                    key={columnIndex}
                    className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                  >
                    {/* Header */}
                    <div className="grid grid-cols-[42px_minmax(0,1fr)_38px_38px_54px] items-center border-b border-zinc-700 bg-zinc-800/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      <span>#</span>

                      <span>
                        Player
                      </span>

                      <span className="text-center">
                        W
                      </span>

                      <span className="text-center">
                        L
                      </span>

                      <span className="text-right">
                        +/-
                      </span>
                    </div>

                    {/* Players */}
                    {column.map(
                      (
                        standing,
                        index,
                      ) => {
                        const rank =
                          columnIndex *
                            10 +
                          index +
                          1;

                        return (
                          <div
                            key={
                              standing.playerId
                            }
                            className={`grid min-h-12 grid-cols-[42px_minmax(0,1fr)_38px_38px_54px] items-center border-b border-zinc-800 px-3 py-2 last:border-b-0 ${
                              rank === 1
                                ? "bg-yellow-500/15"
                                : rank === 2
                                  ? "bg-zinc-300/5"
                                  : rank === 3
                                    ? "bg-orange-500/10"
                                    : ""
                            }`}
                          >
                            <span className="text-base font-black text-yellow-400">
                              {getRankDisplay(
                                rank,
                              )}
                            </span>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">
                                {
                                  standing.name
                                }
                              </p>

                              <p className="text-[10px] text-zinc-500">
                                DUPR{" "}
                                {Number(
                                  standing.dupr,
                                ).toFixed(
                                  2,
                                )}
                              </p>
                            </div>

                            <span className="text-center text-sm font-black text-green-400">
                              {
                                standing.wins
                              }
                            </span>

                            <span className="text-center text-sm font-black text-red-400">
                              {
                                standing.losses
                              }
                            </span>

                            <span
                              className={`text-right text-sm font-black ${
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
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                ),
              )}
            </div>

            {standings.length > 30 && (
              <p className="text-center text-xs text-zinc-500">
                Showing the top 30 of{" "}
                {standings.length} season
                participants.
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}