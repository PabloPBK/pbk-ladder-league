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
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("league_id", leagueId)
    .order("created_at");

  if (error) throw error;

  return data as SeasonRecord[];
}