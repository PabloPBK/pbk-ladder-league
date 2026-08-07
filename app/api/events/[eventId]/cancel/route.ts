import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

type RoundRecord = {
  id: string;
};

type CourtRecord = {
  id: string;
};

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { eventId } = await context.params;

    if (!eventId) {
      return NextResponse.json(
        { error: "A league event ID is required." },
        { status: 400 },
      );
    }

    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select("id, name, status")
        .eq("id", eventId)
        .maybeSingle();

    if (eventError) {
      throw eventError;
    }

    if (!event) {
      return NextResponse.json(
        { error: "The league session was not found." },
        { status: 404 },
      );
    }

    if (event.status === "complete") {
      return NextResponse.json(
        {
          error:
            "Completed league sessions cannot be deleted from Admin. They must remain available in History.",
        },
        { status: 409 },
      );
    }

    const { data: roundData, error: roundsLookupError } =
      await supabaseAdmin
        .from("rounds")
        .select("id")
        .eq("event_id", eventId);

    if (roundsLookupError) {
      throw roundsLookupError;
    }

    const rounds = (roundData ?? []) as RoundRecord[];
    const roundIds = rounds.map((round) => round.id);

    let courtIds: string[] = [];

    if (roundIds.length > 0) {
      const { data: courtData, error: courtsLookupError } =
        await supabaseAdmin
          .from("courts")
          .select("id")
          .in("round_id", roundIds);

      if (courtsLookupError) {
        throw courtsLookupError;
      }

      courtIds = ((courtData ?? []) as CourtRecord[]).map(
        (court) => court.id,
      );
    }

    if (courtIds.length > 0) {
      const { error: courtPlayersDeleteError } =
        await supabaseAdmin
          .from("court_players")
          .delete()
          .in("court_id", courtIds);

      if (courtPlayersDeleteError) {
        throw courtPlayersDeleteError;
      }
    }

    if (roundIds.length > 0) {
      const { error: roundByesDeleteError } =
        await supabaseAdmin
          .from("round_byes")
          .delete()
          .in("round_id", roundIds);

      if (roundByesDeleteError) {
        throw roundByesDeleteError;
      }

      const { error: courtsDeleteError } =
        await supabaseAdmin
          .from("courts")
          .delete()
          .in("round_id", roundIds);

      if (courtsDeleteError) {
        throw courtsDeleteError;
      }

      const { error: roundsDeleteError } =
        await supabaseAdmin
          .from("rounds")
          .delete()
          .eq("event_id", eventId);

      if (roundsDeleteError) {
        throw roundsDeleteError;
      }
    }

    const { error: eventPlayersDeleteError } =
      await supabaseAdmin
        .from("event_players")
        .delete()
        .eq("event_id", eventId);

    if (eventPlayersDeleteError) {
      throw eventPlayersDeleteError;
    }

    const { error: eventDeleteError } =
      await supabaseAdmin
        .from("league_events")
        .delete()
        .eq("id", eventId);

    if (eventDeleteError) {
      throw eventDeleteError;
    }

    return NextResponse.json(
      {
        deleted: true,
        eventId,
        eventName: event.name,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unable to delete league session:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete the league session.",
      },
      { status: 500 },
    );
  }
}
