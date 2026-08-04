import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
    courtNumber: string;
  }>;
};

type SaveScoreRequest = {
  team1Score?: number;
  team2Score?: number;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { eventId, courtNumber: courtNumberText } =
      await context.params;

    const body =
      (await request.json()) as SaveScoreRequest;

    const courtNumber = Number(courtNumberText);
    const team1Score = Number(body.team1Score);
    const team2Score = Number(body.team2Score);

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

    if (
      !Number.isInteger(courtNumber) ||
      courtNumber < 1
    ) {
      return NextResponse.json(
        {
          error: "The court number is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(team1Score) ||
      !Number.isInteger(team2Score)
    ) {
      return NextResponse.json(
        {
          error: "Scores must be whole numbers.",
        },
        {
          status: 400,
        },
      );
    }

    if (team1Score < 0 || team2Score < 0) {
      return NextResponse.json(
        {
          error: "Scores cannot be negative.",
        },
        {
          status: 400,
        },
      );
    }

    if (team1Score === team2Score) {
      return NextResponse.json(
        {
          error: "The final score cannot be tied.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: event, error: eventError } =
      await supabaseAdmin
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
            "Scores cannot be changed after the league event is complete.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: round, error: roundError } =
      await supabaseAdmin
        .from("rounds")
        .select("id, round_number")
        .eq("event_id", eventId)
        .eq("round_number", event.current_round)
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

    const { data: court, error: courtError } =
      await supabaseAdmin
        .from("courts")
        .select("id, court_number")
        .eq("round_id", round.id)
        .eq("court_number", courtNumber)
        .single();

    if (courtError || !court) {
      return NextResponse.json(
        {
          error: `Court ${courtNumber} was not found.`,
        },
        {
          status: 404,
        },
      );
    }

    const {
      data: courtPlayers,
      error: courtPlayersError,
    } = await supabaseAdmin
      .from("court_players")
      .select("id, team_number")
      .eq("court_id", court.id);

    if (courtPlayersError) {
      throw courtPlayersError;
    }

    const team1Players = (courtPlayers ?? []).filter(
      (courtPlayer) =>
        courtPlayer.team_number === 1,
    );

    const team2Players = (courtPlayers ?? []).filter(
      (courtPlayer) =>
        courtPlayer.team_number === 2,
    );

    if (
      team1Players.length !== 2 ||
      team2Players.length !== 2
    ) {
      return NextResponse.json(
        {
          error:
            "Both teams must be confirmed in Walking Mode before saving a score.",
        },
        {
          status: 400,
        },
      );
    }

    const winnerTeam =
      team1Score > team2Score ? 1 : 2;

    const completedAt =
      new Date().toISOString();

    const { data: savedCourt, error: saveError } =
      await supabaseAdmin
        .from("courts")
        .update({
          team_1_score: team1Score,
          team_2_score: team2Score,
          winner_team: winnerTeam,
          complete: true,
          completed_at: completedAt,
        })
        .eq("id", court.id)
        .select(
          "id, court_number, team_1_score, team_2_score, winner_team, complete, completed_at",
        )
        .single();

    if (saveError || !savedCourt) {
      throw (
        saveError ??
        new Error("Unable to save the court score.")
      );
    }

    const {
      data: roundCourts,
      error: roundCourtsError,
    } = await supabaseAdmin
      .from("courts")
      .select("id, complete")
      .eq("round_id", round.id);

    if (roundCourtsError) {
      throw roundCourtsError;
    }

    const roundComplete =
      (roundCourts ?? []).length > 0 &&
      (roundCourts ?? []).every(
        (roundCourt) => roundCourt.complete,
      );

    if (roundComplete) {
      const { error: updateRoundError } =
        await supabaseAdmin
          .from("rounds")
          .update({
            status: "complete",
          })
          .eq("id", round.id);

      if (updateRoundError) {
        throw updateRoundError;
      }
    }

    return NextResponse.json({
      court: savedCourt,
      roundComplete,
    });
  } catch (error) {
    console.error(
      "Unable to save court score:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the court score.",
      },
      {
        status: 500,
      },
    );
  }
}