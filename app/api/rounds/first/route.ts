import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type AssignedPlayer = {
  databasePlayerId: string;
  slotNumber: number;
};

type SubmittedCourt = {
  courtNumber: number;
  players: AssignedPlayer[];
};

type SaveFirstRoundRequest = {
  eventId?: string;
  roundNumber?: number;
  courts?: SubmittedCourt[];
};

export async function POST(request: Request) {
  let createdRoundId: string | null = null;

  try {
    const body =
      (await request.json()) as SaveFirstRoundRequest;

    const eventId = body.eventId?.trim();
    const roundNumber = body.roundNumber ?? 1;
    const submittedCourts = body.courts ?? [];

    if (!eventId) {
      return NextResponse.json(
        { error: "A league event ID is required." },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(roundNumber) ||
      roundNumber < 1
    ) {
      return NextResponse.json(
        { error: "The round number is invalid." },
        { status: 400 },
      );
    }

    if (submittedCourts.length === 0) {
      return NextResponse.json(
        { error: "At least one court is required." },
        { status: 400 },
      );
    }

    for (const court of submittedCourts) {
      if (
        !Number.isInteger(court.courtNumber) ||
        court.courtNumber < 1
      ) {
        return NextResponse.json(
          { error: "A court number is invalid." },
          { status: 400 },
        );
      }

      if (court.players.length !== 4) {
        return NextResponse.json(
          {
            error: `Court ${court.courtNumber} must have exactly four players.`,
          },
          { status: 400 },
        );
      }

      const playerIds = court.players.map(
        (player) => player.databasePlayerId,
      );

      if (
        playerIds.some((playerId) => !playerId) ||
        new Set(playerIds).size !== 4
      ) {
        return NextResponse.json(
          {
            error: `Court ${court.courtNumber} has an invalid or duplicate player assignment.`,
          },
          { status: 400 },
        );
      }
    }

    const allPlayerIds = submittedCourts.flatMap(
      (court) =>
        court.players.map(
          (player) => player.databasePlayerId,
        ),
    );

    if (
      new Set(allPlayerIds).size !== allPlayerIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "A player cannot be assigned to more than one court.",
        },
        { status: 400 },
      );
    }

    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select("id, status")
        .eq("id", eventId)
        .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "The selected league event was not found." },
        { status: 404 },
      );
    }

    if (event.status === "complete") {
      return NextResponse.json(
        {
          error:
            "A round cannot be added to a completed event.",
        },
        { status: 400 },
      );
    }

    const { data: existingRound } =
      await supabaseAdmin
        .from("rounds")
        .select("id")
        .eq("event_id", eventId)
        .eq("round_number", roundNumber)
        .maybeSingle();

    if (existingRound) {
      return NextResponse.json(
        {
          error: `Round ${roundNumber} has already been saved for this event.`,
        },
        { status: 409 },
      );
    }

    const eventPlayerRows = allPlayerIds.map(
      (playerId) => ({
        event_id: eventId,
        player_id: playerId,
        checked_in: true,
      }),
    );

    const {
      data: savedEventPlayers,
      error: eventPlayersError,
    } = await supabaseAdmin
      .from("event_players")
      .upsert(eventPlayerRows, {
        onConflict: "event_id,player_id",
      })
      .select("id, player_id");

    if (
      eventPlayersError ||
      !savedEventPlayers
    ) {
      throw (
        eventPlayersError ??
        new Error("Unable to save checked-in players.")
      );
    }

    const eventPlayerIdByPlayerId = new Map(
      savedEventPlayers.map((eventPlayer) => [
        eventPlayer.player_id,
        eventPlayer.id,
      ]),
    );

    const { data: savedRound, error: roundError } =
      await supabaseAdmin
        .from("rounds")
        .insert({
          event_id: eventId,
          round_number: roundNumber,
          status: "pairing",
        })
        .select(
          "id, event_id, round_number, status",
        )
        .single();

    if (roundError || !savedRound) {
      throw (
        roundError ??
        new Error("Unable to save the round.")
      );
    }

    createdRoundId = savedRound.id;

    const courtRows = submittedCourts.map(
      (court) => ({
        round_id: savedRound.id,
        court_number: court.courtNumber,
        complete: false,
      }),
    );

    const { data: savedCourts, error: courtsError } =
      await supabaseAdmin
        .from("courts")
        .insert(courtRows)
        .select("id, court_number");

    if (courtsError || !savedCourts) {
      throw (
        courtsError ??
        new Error("Unable to save the courts.")
      );
    }

    const courtIdByNumber = new Map(
      savedCourts.map((court) => [
        court.court_number,
        court.id,
      ]),
    );

    const courtPlayerRows = submittedCourts.flatMap(
      (court) => {
        const databaseCourtId = courtIdByNumber.get(
          court.courtNumber,
        );

        if (!databaseCourtId) {
          throw new Error(
            `Database court ${court.courtNumber} was not found.`,
          );
        }

        return court.players.map((player) => {
          const eventPlayerId =
            eventPlayerIdByPlayerId.get(
              player.databasePlayerId,
            );

          if (!eventPlayerId) {
            throw new Error(
              "An event-player record was not found.",
            );
          }

          return {
            court_id: databaseCourtId,
            event_player_id: eventPlayerId,
            slot_number: player.slotNumber,
            team_number: null,
          };
        });
      },
    );

    const { error: courtPlayersError } =
      await supabaseAdmin
        .from("court_players")
        .insert(courtPlayerRows);

    if (courtPlayersError) {
      throw courtPlayersError;
    }

    const { error: eventUpdateError } =
      await supabaseAdmin
        .from("league_events")
        .update({
          status: "active",
          current_round: roundNumber,
        })
        .eq("id", eventId);

    if (eventUpdateError) {
      throw eventUpdateError;
    }

    return NextResponse.json(
      {
        round: savedRound,
        courtCount: savedCourts.length,
        playerCount: courtPlayerRows.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to save Round 1:", error);

    if (createdRoundId) {
      await supabaseAdmin
        .from("rounds")
        .delete()
        .eq("id", createdRoundId);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save Round 1.",
      },
      { status: 500 },
    );
  }
}