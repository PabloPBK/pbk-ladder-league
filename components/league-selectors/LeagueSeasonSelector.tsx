"use client";

import { useEffect, useState } from "react";

import {
  getActiveLeagues,
  getSeasonsForLeague,
  type LeagueRecord,
  type SeasonRecord,
} from "@/lib/data/leagues";

type LeagueSeasonSelectorProps = {
  selectedLeagueId: string;
  selectedSeasonId: string;
  onLeagueChange: (leagueId: string) => void;
  onSeasonChange: (seasonId: string) => void;
};

export function LeagueSeasonSelector({
  selectedLeagueId,
  selectedSeasonId,
  onLeagueChange,
  onSeasonChange,
}: LeagueSeasonSelectorProps) {
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLeagues() {
      try {
        setLoadingLeagues(true);
        setErrorMessage("");

        const leagueRecords = await getActiveLeagues();

        if (cancelled) {
          return;
        }

        setLeagues(leagueRecords);
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
          setLoadingLeagues(false);
        }
      }
    }

    void loadLeagues();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedLeagueId || leagues.length === 0) {
      return;
    }

    onLeagueChange(leagues[0].id);
  }, [leagues, onLeagueChange, selectedLeagueId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSeasons() {
      if (!selectedLeagueId) {
        setSeasons([]);
        return;
      }

      try {
        setLoadingSeasons(true);
        setErrorMessage("");

        const seasonRecords =
          await getSeasonsForLeague(selectedLeagueId);

        if (cancelled) {
          return;
        }

        setSeasons(seasonRecords);
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
          setLoadingSeasons(false);
        }
      }
    }

    void loadSeasons();

    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId]);

  useEffect(() => {
    if (!selectedLeagueId) {
      return;
    }

    if (seasons.length === 0) {
      if (selectedSeasonId) {
        onSeasonChange("");
      }

      return;
    }

    const selectedSeasonStillExists = seasons.some(
      (season) => season.id === selectedSeasonId,
    );

    if (selectedSeasonStillExists) {
      return;
    }

    const activeSeason =
      seasons.find((season) => season.status === "active") ??
      seasons[0];

    onSeasonChange(activeSeason.id);
  }, [
    onSeasonChange,
    seasons,
    selectedLeagueId,
    selectedSeasonId,
  ]);

  return (
    <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">
          League Night
        </h2>

        <p className="mt-1 text-zinc-400">
          Select the league and season for tonight&apos;s event.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold uppercase tracking-wide text-zinc-400">
            League
          </span>

          <select
            value={selectedLeagueId}
            disabled={loadingLeagues}
            onChange={(event) => {
              onLeagueChange(event.target.value);
              onSeasonChange("");
            }}
            className="min-h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-lg text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:text-zinc-500"
          >
            <option value="">
              {loadingLeagues
                ? "Loading leagues..."
                : "Select a league"}
            </option>

            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Season
          </span>

          <select
            value={selectedSeasonId}
            disabled={!selectedLeagueId || loadingSeasons}
            onChange={(event) =>
              onSeasonChange(event.target.value)
            }
            className="min-h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-lg text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:text-zinc-500"
          >
            <option value="">
              {loadingSeasons
                ? "Loading seasons..."
                : selectedLeagueId
                  ? "Select a season"
                  : "Select a league first"}
            </option>

            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
                {season.status === "active"
                  ? " — Active"
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedLeagueId && selectedSeasonId && (
        <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
          League and season selected. Tonight&apos;s event will
          be stored under this season.
        </div>
      )}
    </section>
  );
}