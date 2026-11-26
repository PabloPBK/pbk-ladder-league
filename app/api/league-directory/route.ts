import { NextResponse } from "next/server";
import { buildLeagueDirectory } from "@/lib/data/league-directory";
import { getStaffApiDenial } from "@/lib/server/require-auth";
import { getTVDatabase } from "@/lib/server/tv-database";
import { supabaseAdmin } from "@/lib/supabase-admin";

const pacificDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export async function GET() {
  const denial = await getStaffApiDenial();
  if (denial) return denial;

  try {
    const [leagues, events] = await Promise.all([
      supabaseAdmin.from("leagues").select("id, name, active, seasons(id, name, status, start_date, end_date)"),
      getTVDatabase().from("roster_events").select("id, name, event_date"),
    ]);
    if (leagues.error || events.error) throw leagues.error ?? events.error;

    const directory = buildLeagueDirectory(leagues.data ?? [], events.data ?? [], pacificDate.format(new Date()));
    return NextResponse.json(directory, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load league directory:", error);
    return NextResponse.json({ error: "Unable to load leagues." }, { status: 500 });
  }
}
