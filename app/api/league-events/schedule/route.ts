import { NextResponse } from "next/server";
import { isUuid } from "@/lib/data/league-listings";
import { buildLeagueSessionOptions } from "@/lib/data/league-session-schedule";
import { getStaffApiDenial } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const denial = await getStaffApiDenial();
  if (denial) return denial;

  const seasonId = new URL(request.url).searchParams.get("seasonId") ?? "";
  if (!isUuid(seasonId)) return NextResponse.json({ error: "Choose a valid season." }, { status: 400 });

  try {
    const [events, listings, scheduled] = await Promise.all([
      supabaseAdmin.from("league_events")
        .select("id, season_id, event_date, name, status, current_round, session_number, session_note, created_at")
        .eq("season_id", seasonId),
      supabaseAdmin.from("league_listings").select("registration_sessions")
        .eq("season_id", seasonId).eq("status", "published"),
      supabaseAdmin.from("league_season_schedule").select("event_date, session_number").eq("season_id", seasonId),
    ]);
    if (events.error || listings.error || scheduled.error) throw events.error ?? listings.error ?? scheduled.error;
    const registrations = (listings.data ?? []).flatMap(({ registration_sessions }) =>
      Array.isArray(registration_sessions) ? registration_sessions.filter((entry) =>
        typeof entry?.date === "string" && typeof entry?.start_time === "string"
      ) : [],
    );
    const sessions = buildLeagueSessionOptions(events.data ?? [], registrations, scheduled.data ?? []);
    return NextResponse.json({ sessions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load league session dates:", error);
    return NextResponse.json({ error: "Unable to load league session dates." }, { status: 500 });
  }
}
