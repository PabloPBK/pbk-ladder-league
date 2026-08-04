"use client";

import { useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { StandingsTable } from "@/components/display/StandingsTable";
import {
  getActiveLeagues,
  getSeasonsForLeague,
  type LeagueRecord,
  type SeasonRecord,
} from "@/lib/data/leagues";
import { getSeasonStandings } from "@/lib/data/standings";
import { SeasonStanding } from "@/lib/server/statistics";

export default function DisplayPage() {
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeagues() {
      const leagueData = await getActiveLeagues();

      setLeagues(leagueData);

      if (leagueData.length > 0) {
        setLeagueId(leagueData[0].id);
      }
    }

    void loadLeagues();
  }, []);

  useEffect(() => {
    if (!leagueId) return;

    async function loadSeasons() {
      const seasonData =
        await getSeasonsForLeague(leagueId);

      setSeasons(seasonData);

      if (seasonData.length > 0) {
        setSeasonId(seasonData[0].id);
      }
    }

    void loadSeasons();
  }, [leagueId]);

  useEffect(() => {
    if (!seasonId) return;

    async function loadStandings() {
      setLoading(true);

      try {
        const data =
          await getSeasonStandings(seasonId);

        setStandings(data);
      } finally {
        setLoading(false);
      }
    }

    void loadStandings();

    const timer = setInterval(() => {
      void loadStandings();
    }, 30000);

    return () => clearInterval(timer);
  }, [seasonId]);

  return (
    <AppLayout
      title="Club Display"
      description="Live season standings."
    >
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <select
          value={leagueId}
          onChange={(e) =>
            setLeagueId(e.target.value)
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-3"
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
          onChange={(e) =>
            setSeasonId(e.target.value)
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-3"
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

      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          Loading standings...
        </div>
      ) : (
        <StandingsTable standings={standings} />
      )}
    </AppLayout>
  );
}