import { NextResponse } from "next/server";
import { isUuid } from "@/lib/data/league-listings";
import type { HistoricalPaidEntries } from "@/lib/data/league-session-revenue";
import { getRevenueApiDenial } from "@/lib/server/require-revenue-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Row = {
  member_count: number;
  nonmember_count: number;
  league_events: { seasons: { league_id: string } };
};

export async function GET(request: Request) {
  const denial = await getRevenueApiDenial();
  if (denial) return denial;

  const leagueId = new URL(request.url).searchParams.get("leagueId");
  if (leagueId && !isUuid(leagueId)) return NextResponse.json({ error: "Invalid league." }, { status: 400 });

  try {
    const all: HistoricalPaidEntries = { members: 0, nonmembers: 0, reports: 0, scope: "all" };
    const league: HistoricalPaidEntries = { ...all, scope: "league" };
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabaseAdmin.from("league_session_revenue")
        .select("member_count, nonmember_count, league_events!inner(seasons!inner(league_id))")
        .eq("league_events.status", "complete")
        .order("event_id").range(offset, offset + pageSize - 1).overrideTypes<Row[], { merge: false }>();
      if (error) throw error;

      for (const row of data) {
        if (row.member_count + row.nonmember_count === 0) continue;

        all.members += row.member_count;
        all.nonmembers += row.nonmember_count;
        all.reports += 1;
        if (row.league_events.seasons.league_id === leagueId) {
          league.members += row.member_count;
          league.nonmembers += row.nonmember_count;
          league.reports += 1;
        }
      }
      if (data.length < pageSize) break;
    }

    const mix = league.reports ? league : all.reports ? all : null;
    return NextResponse.json({ mix }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load historical league revenue:", error);
    return NextResponse.json({ error: "Unable to load historical membership counts." }, { status: 500 });
  }
}
