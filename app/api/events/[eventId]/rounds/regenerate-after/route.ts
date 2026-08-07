import { NextResponse } from "next/server";

import { generateNextRoundResponse } from "@/lib/server/ladder-rounds";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

type RegenerateBody = {
  editedRoundNumber?: number;
  force?: boolean;
};

type RoundRecord = {
  id: string;
  round_number: number;
};

type CourtRecord = {
  id: string;
  round_id: string;
  team_1_score: number | null;
  team_2_score: number | null;
  complete: boolean;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { eventId } = await context.params;
    const body = (await request.json()) as RegenerateBody;

    const editedRoundNumber = Number(
      body.editedRoundNumber,
    );

    if (
      !eventId ||
      !Number.isInteger(editedRoundNumber) ||
      editedRoundNumber < 1
    ) {
      return NextResponse.json(
        {
          error:
            "A valid event ID and edited round number are required.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: event,
      error: eventError,
    } = await supabaseAdmin
      .from("league_events")
      .select("id, status, current_round")
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
          error:
            "Rounds cannot be regenerated after the league event is completed.",
        },
        {
          status: 400,
        },
      );
    }

    const currentRoundNumber = Number(
      event.current_round,
    );

    if (
      editedRoundNumber >= currentRoundNumber
    ) {
      return NextResponse.json({
        regenerated: false,
        currentRoundNumber,
        message:
          "The edited round is already the current round.",
      });
    }

    const {
      data: laterRoundData,
      error: laterRoundsError,
    } = await supabaseAdmin
      .from("rounds")
      .select("id, round_number")
      .eq("event_id", eventId)
      .gt("round_number", editedRoundNumber)
      .order("round_number", {
        ascending: true,
      });

    if (laterRoundsError) {
      throw laterRoundsError;
    }

    const laterRounds =
      (laterRoundData ?? []) as RoundRecord[];

    if (laterRounds.length === 0) {
      await supabaseAdmin
        .from("league_events")
        .update({
          status: "active",
          current_round: editedRoundNumber,
        })
        .eq("id", eventId);

      return generateNextRoundResponse(eventId);
    }

    const laterRoundIds = laterRounds.map(
      (round) => round.id,
    );

    const {
      data: laterCourtData,
      error: laterCourtsError,
    } = await supabaseAdmin
      .from("courts")
      .select(
        `
        id,
        round_id,
        team_1_score,
        team_2_score,
        complete
        `,
      )
      .in("round_id", laterRoundIds);

    if (laterCourtsError) {
      throw laterCourtsError;
    }

    const laterCourts =
      (laterCourtData ?? []) as CourtRecord[];

    const laterRoundsHaveScores =
      laterCourts.some(
        (court) =>
          court.complete ||
          court.team_1_score !== null ||
          court.team_2_score !== null,
      );

    if (
      laterRoundsHaveScores &&
      !body.force
    ) {
      return NextResponse.json(
        {
          error:
            "Later rounds already contain saved scores.",
          requiresConfirmation: true,
          laterRoundNumbers:
            laterRounds.map(
              (round) =>
                round.round_number,
            ),
        },
        {
          status: 409,
        },
      );
    }

    const laterCourtIds = laterCourts.map(
      (court) => court.id,
    );

    if (laterCourtIds.length > 0) {
      const {
        error: deleteCourtPlayersError,
      } = await supabaseAdmin
        .from("court_players")
        .delete()
        .in("court_id", laterCourtIds);

      if (deleteCourtPlayersError) {
        throw deleteCourtPlayersError;
      }

      const {
        error: deleteCourtsError,
      } = await supabaseAdmin
        .from("courts")
        .delete()
        .in("id", laterCourtIds);

      if (deleteCourtsError) {
        throw deleteCourtsError;
      }
    }

    const {
      error: deleteRoundsError,
    } = await supabaseAdmin
      .from("rounds")
      .delete()
      .in("id", laterRoundIds);

    if (deleteRoundsError) {
      throw deleteRoundsError;
    }

    const {
      error: eventUpdateError,
    } = await supabaseAdmin
      .from("league_events")
      .update({
        status: "active",
        current_round: editedRoundNumber,
      })
      .eq("id", eventId);

    if (eventUpdateError) {
      throw eventUpdateError;
    }

    return generateNextRoundResponse(eventId);
  } catch (error) {
    console.error(
      "Unable to regenerate later rounds:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to regenerate later rounds.",
      },
      {
        status: 500,
      },
    );
  }
}
