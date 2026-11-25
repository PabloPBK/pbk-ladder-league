import "server-only";

import type { LeagueListing, ListingFacility } from "@/lib/data/league-listings";
import { supabaseAdmin } from "@/lib/supabase-admin";

const fields = "id, name, facility_id, league_id, season_id, description, format, skill_level, dupr_rated, start_date, end_date, registration_url, registration_sessions, logo_url, pricing, status, registration_status, show_daily_standings, show_season_standings, show_player_stats, show_history, updated_at";

export async function getListingFacilities(): Promise<ListingFacility[]> {
  const { data, error } = await supabaseAdmin.from("tournament_facilities")
    .select("id,name,city,state").order("name");
  if (error) throw error;
  return data;
}

export async function getLeagueListings({ published, facilityId }: { published: boolean; facilityId?: string }) {
  const rows: LeagueListing[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabaseAdmin.from("league_listings").select(fields)
      .order("start_date").order("id").range(offset, offset + pageSize - 1);
    if (published) query = query.eq("status", "published");
    if (facilityId) query = query.eq("facility_id", facilityId);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data as LeagueListing[]);
    if (data.length < pageSize) return rows;
  }
}

export async function getPublishedLeagueListing(id: string): Promise<LeagueListing | null> {
  const { data, error } = await supabaseAdmin.from("league_listings")
    .select(fields).eq("id", id).eq("status", "published").maybeSingle();
  if (error) throw error;
  return data as LeagueListing | null;
}

export async function getListingSeasonOptions() {
  const [leagues, seasons] = await Promise.all([
    supabaseAdmin.from("leagues").select("id,name").order("name"),
    supabaseAdmin.from("seasons").select("id,league_id,name,start_date").order("start_date", { ascending: false }),
  ]);
  if (leagues.error) throw leagues.error;
  if (seasons.error) throw seasons.error;
  return { leagues: leagues.data, seasons: seasons.data };
}

export async function getPublishedLeagueEvents(seasonId: string, leagueId: string | null) {
  const season = await supabaseAdmin.from("seasons").select("league_id").eq("id", seasonId).maybeSingle();
  if (season.error) throw season.error;
  if (!season.data || (leagueId && leagueId !== season.data.league_id)) return null;

  const events = await supabaseAdmin.from("league_events").select("id,name,event_date,session_number")
    .eq("season_id", seasonId).eq("status", "complete")
    .order("event_date", { ascending: false }).order("session_number", { ascending: false }).order("id");
  if (events.error) throw events.error;
  return events.data;
}
