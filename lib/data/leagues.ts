import { supabase } from "@/lib/supabase";

export type LeagueRecord = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export type SeasonRecord = {
  id: string;
  league_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "complete" | "archived";
};

export async function getActiveLeagues() {
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) throw error;

  return data as LeagueRecord[];
}

export async function getSeasonsForLeague(leagueId: string) {
  const response = await fetch(`/api/seasons?leagueId=${encodeURIComponent(leagueId)}`, {
    cache: "no-store",
  });
  const result = (await response.json()) as { seasons?: SeasonRecord[]; error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to load seasons.");
  }

  return result.seasons ?? [];
}

export async function createSeason({
  leagueId,
  seasonNumber,
  startDate,
}: {
  leagueId: string;
  seasonNumber?: number;
  startDate?: string;
}) {
  const response = await fetch("/api/seasons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId, seasonNumber, startDate }),
  });
  const result = (await response.json()) as { season?: SeasonRecord; error?: string };

  if (!response.ok || !result.season) {
    throw new Error(result.error ?? "Unable to create season.");
  }

  return result.season;
}
