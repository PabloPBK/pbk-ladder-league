import { NextResponse } from "next/server";
import { isUuid } from "@/lib/data/league-listings";
import { seasonRevenueCsv, summarizeSeasonRevenue, type SeasonRevenueSession } from "@/lib/data/league-session-revenue";
import { getStaffApiDenial } from "@/lib/server/require-auth";
import { buildSeasonRevenuePdf } from "@/lib/server/season-revenue-pdf";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Season = {
  name: string;
  leagues: { name: string } | null;
  league_events: SeasonRevenueSession[];
};
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  const denial = await getStaffApiDenial();
  if (denial) return denial;

  const { seasonId } = await params;
  if (!isUuid(seasonId)) return NextResponse.json({ error: "Invalid season." }, { status: 400 });

  try {
    const { data, error } = await supabaseAdmin.from("seasons")
      .select("name, leagues(name), league_events(event_date, session_number, name, status, league_session_revenue(member_count, nonmember_count, updated_at))")
      .eq("id", seasonId).maybeSingle().overrideTypes<Season, { merge: false }>();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Season not found." }, { status: 404 });

    const league = data.leagues?.name?.trim() ?? "";
    const season = data.name;
    const sessions = data.league_events;
    const format = new URL(request.url).searchParams.get("format");
    if (format !== "pdf" && format !== "csv") {
      return NextResponse.json({ season, totals: summarizeSeasonRevenue(sessions) }, { headers });
    }

    const suffix = season.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "season";
    const body = format === "pdf"
      ? await buildSeasonRevenuePdf(league, season, summarizeSeasonRevenue(sessions))
      : seasonRevenueCsv(league, season, sessions);

    return new NextResponse(body, {
      headers: {
        ...headers,
        "Content-Type": format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${suffix}-revenue.${format}"`,
      },
    });
  } catch (error) {
    console.error("Unable to load season revenue:", error);
    return NextResponse.json({ error: "Unable to load the season revenue report." }, { status: 500 });
  }
}
