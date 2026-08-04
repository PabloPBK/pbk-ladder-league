import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    // Active event
    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select(
          `
          id,
          season_id,
          event_date,
          name,
          status,
          current_round,
          session_number
          `,
        )
        .eq("status", "active")
        .order("event_date", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (eventError) throw eventError;

    if (!event) {
      return NextResponse.json({
        event: null,
      });
    }

    // Season
    const { data: season } =
      await supabaseAdmin
        .from("seasons")
        .select("id, name, league_id")
        .eq("id", event.season_id)
        .maybeSingle();

    // League
    let league = null;

    if (season?.league_id) {
      const { data } =
        await supabaseAdmin
          .from("leagues")
          .select("id, name")
          .eq("id", season.league_id)
          .maybeSingle();

      league = data;
    }

    // Players
    const { count: checkedIn } =
      await supabaseAdmin
        .from("event_players")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("event_id", event.id);

    // Courts for current round
    const { data: round } =
      await supabaseAdmin
        .from("rounds")
        .select("id")
        .eq("event_id", event.id)
        .eq("round_number", event.current_round)
        .maybeSingle();

    let courts = 0;

    if (round) {
      const { count } =
        await supabaseAdmin
          .from("courts")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("round_id", round.id);

      courts = count ?? 0;
    }

    return NextResponse.json({
      league: league?.name ?? null,
      season: season?.name ?? null,
      event: {
        id: event.id,
        name: event.name,
        date: event.event_date,
        status: event.status,
        currentRound: event.current_round,
        session: event.session_number ?? 1,
      },
      summary: {
        checkedIn: checkedIn ?? 0,
        courts,
      },
    });
  } catch (error) {
    console.error(
      "Unable to load dashboard:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load dashboard.",
      },
      {
        status: 500,
      },
    );
  }
}