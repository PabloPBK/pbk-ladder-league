import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

type SwapPlayerLocation = {
  courtNumber?: number;
  slotNumber?: number;
};

type SwapPlayersRequest = {
  first?: SwapPlayerLocation;
  second?: SwapPlayerLocation;
};

type CourtRecord = {
  id: string;
  court_number: number;
  complete: boolean;
  team_1_score: number | null;
  team_2_score: number | null;
};

type CourtPlayerRecord = {
  id: string;
  court_id: string;
  event_player_id: string;
  slot_number: number;
};

function isValidLocation(
  location: SwapPlayerLocation | undefined,
): location is Required<SwapPlayerLocation> {
  return Boolean(
    location &&
      Number.isInteger(location.courtNumber) &&
      Number(location.courtNumber) >= 1 &&
      Number.isInteger(location.slotNumber) &&
      Number(location.slotNumber) >= 1 &&
      Number(location.slotNumber) <= 4,
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { eventId } = await context.params;
    const body =
      (await request.json()) as SwapPlayersRequest;

    if (!eventId) {
      return NextResponse.json(
        { error: "A league event ID is required." },
        { status: 400 },
      );
    }

    if (
      !isValidLocation(body.first) ||
      !isValidLocation(body.second)
    ) {
      return NextResponse.json(
        {
          error:
            "Two valid Round 1 player locations are required.",
        },
        { status: 400 },
      );
    }

    const firstLocation = body.first;
    const secondLocation = body.second;

    if (
      firstLocation.courtNumber ===
        secondLocation.courtNumber &&
      firstLocation.slotNumber ===
        secondLocation.slotNumber
    ) {
      return NextResponse.json(
        {
          error:
            "Choose two different players to swap.",
        },
        { status: 400 },
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
        { error: "The league event was not found." },
        { status: 404 },
      );
    }

    if (event.status === "complete") {
      return NextResponse.json(
        {
          error:
            "Players cannot be moved in a completed event.",
        },
        { status: 400 },
      );
    }

    if (event.current_round !== 1) {
      return NextResponse.json(
        {
          error:
            "Manual player moves are only available during Round 1.",
        },
        { status: 400 },
      );
    }

    const { data: round, error: roundError } =
      await supabaseAdmin
        .from("rounds")
        .select("id, round_number")
        .eq("event_id", eventId)
        .eq("round_number", 1)
        .single();

    if (roundError || !round) {
      return NextResponse.json(
        { error: "Round 1 was not found." },
        { status: 404 },
      );
    }

    const { data: courtData, error: courtsError } =
      await supabaseAdmin
        .from("courts")
        .select(
          "id, court_number, complete, team_1_score, team_2_score",
        )
        .eq("round_id", round.id);

    if (courtsError) {
      throw courtsError;
    }

    const courts =
      (courtData ?? []) as CourtRecord[];

    const scoreAlreadySaved = courts.some(
      (court) =>
        court.complete ||
        court.team_1_score !== null ||
        court.team_2_score !== null,
    );

    if (scoreAlreadySaved) {
      return NextResponse.json(
        {
          error:
            "Round 1 players cannot be moved after any score has been saved.",
        },
        { status: 409 },
      );
    }

    const courtByNumber = new Map(
      courts.map((court) => [
        court.court_number,
        court,
      ]),
    );

    const firstCourt = courtByNumber.get(
      firstLocation.courtNumber,
    );
    const secondCourt = courtByNumber.get(
      secondLocation.courtNumber,
    );

    if (!firstCourt || !secondCourt) {
      return NextResponse.json(
        {
          error:
            "One of the selected courts was not found.",
        },
        { status: 404 },
      );
    }

    const selectedCourtIds = [
      ...new Set([
        firstCourt.id,
        secondCourt.id,
      ]),
    ];

    const {
      data: courtPlayerData,
      error: courtPlayersError,
    } = await supabaseAdmin
      .from("court_players")
      .select(
        "id, court_id, event_player_id, slot_number",
      )
      .in("court_id", selectedCourtIds);

    if (courtPlayersError) {
      throw courtPlayersError;
    }

    const courtPlayers =
      (courtPlayerData ?? []) as CourtPlayerRecord[];

    const firstAssignment = courtPlayers.find(
      (assignment) =>
        assignment.court_id === firstCourt.id &&
        assignment.slot_number ===
          firstLocation.slotNumber,
    );

    const secondAssignment = courtPlayers.find(
      (assignment) =>
        assignment.court_id === secondCourt.id &&
        assignment.slot_number ===
          secondLocation.slotNumber,
    );

    if (!firstAssignment || !secondAssignment) {
      return NextResponse.json(
        {
          error:
            "One of the selected player assignments was not found.",
        },
        { status: 404 },
      );
    }

    const originalRows = [
      {
        court_id: firstAssignment.court_id,
        event_player_id:
          firstAssignment.event_player_id,
        slot_number:
          firstAssignment.slot_number,
        team_number: null,
      },
      {
        court_id: secondAssignment.court_id,
        event_player_id:
          secondAssignment.event_player_id,
        slot_number:
          secondAssignment.slot_number,
        team_number: null,
      },
    ];

    const swappedRows = [
      {
        court_id: firstAssignment.court_id,
        event_player_id:
          secondAssignment.event_player_id,
        slot_number:
          firstAssignment.slot_number,
        team_number: null,
      },
      {
        court_id: secondAssignment.court_id,
        event_player_id:
          firstAssignment.event_player_id,
        slot_number:
          secondAssignment.slot_number,
        team_number: null,
      },
    ];

    const assignmentIds = [
      firstAssignment.id,
      secondAssignment.id,
    ];

    const { error: deleteError } =
      await supabaseAdmin
        .from("court_players")
        .delete()
        .in("id", assignmentIds);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } =
      await supabaseAdmin
        .from("court_players")
        .insert(swappedRows);

    if (insertError) {
      await supabaseAdmin
        .from("court_players")
        .insert(originalRows);

      throw insertError;
    }

    const { error: resetPlayersError } =
      await supabaseAdmin
        .from("court_players")
        .update({ team_number: null })
        .in("court_id", selectedCourtIds);

    if (resetPlayersError) {
      throw resetPlayersError;
    }

    const { error: resetCourtsError } =
      await supabaseAdmin
        .from("courts")
        .update({
          pairing_index: null,
          team_1_score: null,
          team_2_score: null,
          winner_team: null,
          complete: false,
          completed_at: null,
        })
        .in("id", selectedCourtIds);

    if (resetCourtsError) {
      throw resetCourtsError;
    }

    return NextResponse.json({
      swap: {
        eventId,
        roundNumber: 1,
        first: firstLocation,
        second: secondLocation,
        affectedCourts: [
          ...new Set([
            firstLocation.courtNumber,
            secondLocation.courtNumber,
          ]),
        ],
      },
    });
  } catch (error) {
    console.error(
      "Unable to swap Round 1 players:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to swap the selected players.",
      },
      { status: 500 },
    );
  }
}
