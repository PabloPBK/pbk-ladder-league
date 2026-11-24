import { NextResponse } from "next/server";

import { getCompletedLeagueEvent, LeagueHistoryError } from "@/lib/server/league-event-history";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { eventId } = await context.params;
    if (!eventId) return NextResponse.json({ error: "A league event ID is required." }, { status: 400 });
    return NextResponse.json(await getCompletedLeagueEvent(eventId));
  } catch (error) {
    if (error instanceof LeagueHistoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to load league-night history:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load league-night history." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { requireStaffUser } = await import("@/lib/server/require-auth");
    await requireStaffUser();

    const { eventId } = await context.params;
    const body = (await request.json()) as { seasonId?: string };
    const seasonId = body.seasonId?.trim() ?? "";

    if (!eventId || !seasonId) {
      return NextResponse.json(
        { error: "An event ID and season ID are required." },
        { status: 400 },
      );
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from("league_events")
      .select("id, season_id")
      .eq("id", eventId)
      .single();
    if (eventError || !event) {
      return NextResponse.json({ error: "League night not found." }, { status: 404 });
    }

    const { data: currentSeason, error: currentSeasonError } = await supabaseAdmin
      .from("seasons")
      .select("id, league_id")
      .eq("id", event.season_id)
      .single();
    if (currentSeasonError || !currentSeason) throw currentSeasonError;

    const { data: targetSeason, error: targetSeasonError } = await supabaseAdmin
      .from("seasons")
      .select("id, league_id, name")
      .eq("id", seasonId)
      .single();
    if (targetSeasonError || !targetSeason) {
      return NextResponse.json({ error: "Target season not found." }, { status: 404 });
    }

    if (targetSeason.league_id !== currentSeason.league_id) {
      return NextResponse.json(
        { error: "A league night can only be moved to another season in the same league." },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("league_events")
      .update({ season_id: seasonId })
      .eq("id", eventId);
    if (updateError) throw updateError;

    return NextResponse.json({ seasonId, seasonName: targetSeason.name });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in as staff to edit season assignments." }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update season." },
      { status: 500 },
    );
  }
}
