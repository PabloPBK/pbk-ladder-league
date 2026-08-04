import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { eventId } = await context.params;

    if (!eventId) {
      return NextResponse.json(
        {
          error: "A league event ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select(
          "id, status, current_round",
        )
        .eq("id", eventId)
        .single();

    if (eventError || !event) {
      return NextResponse.json(
        {
          error: "The league event was not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (event.status === "complete") {
      return NextResponse.json(
        {
          event,
          alreadyComplete: true,
        },
        {
          status: 200,
        },
      );
    }

    const { data: round, error: roundError } =
      await supabaseAdmin
        .from("rounds")
        .select("id, round_number, status")
        .eq("event_id", eventId)
        .eq(
          "round_number",
          event.current_round,
        )
        .single();

    if (roundError || !round) {
      return NextResponse.json(
        {
          error: "The current round was not found.",
        },
        {
          status: 404,
        },
      );
    }

    const { data: courts, error: courtsError } =
      await supabaseAdmin
        .from("courts")
        .select(
          "id, court_number, complete, team_1_score, team_2_score",
        )
        .eq("round_id", round.id);

    if (courtsError) {
      throw courtsError;
    }

    const savedCourts = courts ?? [];

    if (savedCourts.length === 0) {
      return NextResponse.json(
        {
          error:
            "The current round does not have any courts.",
        },
        {
          status: 400,
        },
      );
    }

    const incompleteCourt =
      savedCourts.find(
        (court) =>
          !court.complete ||
          court.team_1_score === null ||
          court.team_2_score === null,
      );

    if (incompleteCourt) {
      return NextResponse.json(
        {
          error: `Court ${incompleteCourt.court_number} does not have a completed score.`,
        },
        {
          status: 400,
        },
      );
    }

    const { error: roundUpdateError } =
      await supabaseAdmin
        .from("rounds")
        .update({
          status: "complete",
        })
        .eq("id", round.id);

    if (roundUpdateError) {
      throw roundUpdateError;
    }

    const { data: completedEvent, error: eventUpdateError } =
      await supabaseAdmin
        .from("league_events")
        .update({
          status: "complete",
        })
        .eq("id", eventId)
        .select(
          "id, season_id, event_date, name, status, current_round",
        )
        .single();

    if (
      eventUpdateError ||
      !completedEvent
    ) {
      throw (
        eventUpdateError ??
        new Error(
          "Unable to complete the league event.",
        )
      );
    }

    return NextResponse.json({
      event: completedEvent,
      alreadyComplete: false,
    });
  } catch (error) {
    console.error(
      "Unable to complete league event:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete the league event.",
      },
      {
        status: 500,
      },
    );
  }
}