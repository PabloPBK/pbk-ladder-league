import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
    courtNumber: string;
  }>;
};

type SavePairingRequest = {
  roundNumber?: number;
  team1PlayerIds?: string[];
};

type CourtPlayerRecord = {
  id: string;
  event_player_id: string;
  slot_number: number;
};

function getPairingIndex(team1Slots: number[]) {
  const selected = new Set(team1Slots);

  if (
    (selected.has(1) && selected.has(2)) ||
    (selected.has(3) && selected.has(4))
  ) {
    return 0;
  }

  if (
    (selected.has(1) && selected.has(3)) ||
    (selected.has(2) && selected.has(4))
  ) {
    return 1;
  }

  return 2;
}

async function loadEditableCourt(
  eventId: string,
  courtNumber: number,
  roundNumber: number,
) {
  const { data: event, error: eventError } =
    await supabaseAdmin
      .from("league_events")
      .select("id, status, current_round")
      .eq("id", eventId)
      .single();

  if (eventError || !event) {
    throw new Error("The league event was not found.");
  }

  if (event.status === "complete") {
    throw new Error(
      "Pairings cannot be changed for a completed event.",
    );
  }

  const { data: round, error: roundError } =
    await supabaseAdmin
      .from("rounds")
      .select("id, round_number")
      .eq("event_id", eventId)
      .eq("round_number", roundNumber)
      .single();

  if (roundError || !round) {
    throw new Error("The current round was not found.");
  }

  const { data: court, error: courtError } =
    await supabaseAdmin
      .from("courts")
      .select("id, court_number, complete")
      .eq("round_id", round.id)
      .eq("court_number", courtNumber)
      .single();

  if (courtError || !court) {
    throw new Error(`Court ${courtNumber} was not found.`);
  }

  if (court.complete) {
    throw new Error(
      "Undo or change the score before changing this pairing.",
    );
  }

  return {
    round,
    court,
  };
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { eventId, courtNumber: courtNumberText } =
      await context.params;

    const courtNumber = Number(courtNumberText);
    const body = (await request.json()) as SavePairingRequest;
    const roundNumber = Number(body.roundNumber);
    const team1PlayerIds = body.team1PlayerIds ?? [];

    if (
      !eventId ||
      !Number.isInteger(roundNumber) ||
      roundNumber < 1 ||
      !Number.isInteger(courtNumber) ||
      courtNumber < 1
    ) {
      return NextResponse.json(
        { error: "The event or court number is invalid." },
        { status: 400 },
      );
    }

    if (
      team1PlayerIds.length !== 2 ||
      new Set(team1PlayerIds).size !== 2
    ) {
      return NextResponse.json(
        {
          error:
            "Choose two different players for Team 1.",
        },
        { status: 400 },
      );
    }

    const { round, court } = await loadEditableCourt(
      eventId,
      courtNumber,
      roundNumber,
    );

    const {
      data: courtPlayers,
      error: courtPlayersError,
    } = await supabaseAdmin
      .from("court_players")
      .select("id, event_player_id, slot_number")
      .eq("court_id", court.id)
      .order("slot_number", { ascending: true });

    if (courtPlayersError) {
      throw courtPlayersError;
    }

    if (!courtPlayers || courtPlayers.length !== 4) {
      return NextResponse.json(
        {
          error: `Court ${courtNumber} must have four assigned players.`,
        },
        { status: 400 },
      );
    }

    const typedCourtPlayers =
      courtPlayers as CourtPlayerRecord[];

    const eventPlayerIds = typedCourtPlayers.map(
      (courtPlayer) => courtPlayer.event_player_id,
    );

    const {
      data: eventPlayers,
      error: eventPlayersError,
    } = await supabaseAdmin
      .from("event_players")
      .select("id, player_id")
      .in("id", eventPlayerIds);

    if (eventPlayersError) {
      throw eventPlayersError;
    }

    const playerIdByEventPlayerId = new Map(
      (eventPlayers ?? []).map((eventPlayer) => [
        eventPlayer.id,
        eventPlayer.player_id,
      ]),
    );

    const courtPlayerIds = new Set(
      [...playerIdByEventPlayerId.values()],
    );

    if (
      team1PlayerIds.some(
        (playerId) => !courtPlayerIds.has(playerId),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Every selected player must belong to this court.",
        },
        { status: 400 },
      );
    }

    const team1PlayerIdSet = new Set(team1PlayerIds);
    const team1Slots: number[] = [];

    await Promise.all(
      typedCourtPlayers.map(async (courtPlayer) => {
        const playerId = playerIdByEventPlayerId.get(
          courtPlayer.event_player_id,
        );

        if (!playerId) {
          throw new Error(
            "A court player could not be resolved.",
          );
        }

        const teamNumber = team1PlayerIdSet.has(playerId)
          ? 1
          : 2;

        if (teamNumber === 1) {
          team1Slots.push(courtPlayer.slot_number);
        }

        const { error } = await supabaseAdmin
          .from("court_players")
          .update({ team_number: teamNumber })
          .eq("id", courtPlayer.id);

        if (error) {
          throw error;
        }
      }),
    );

    const pairingIndex = getPairingIndex(team1Slots);

    const { error: updateCourtError } =
      await supabaseAdmin
        .from("courts")
        .update({ pairing_index: pairingIndex })
        .eq("id", court.id);

    if (updateCourtError) {
      throw updateCourtError;
    }

    return NextResponse.json({
      pairing: {
        eventId,
        roundNumber: round.round_number,
        courtNumber,
        pairingIndex,
      },
    });
  } catch (error) {
    console.error("Unable to save court pairing:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the court pairing.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  try {
    const { eventId, courtNumber: courtNumberText } =
      await context.params;
    const courtNumber = Number(courtNumberText);
    const roundNumber = Number(
      new URL(request.url).searchParams.get("roundNumber"),
    );

    if (
      !eventId ||
      !Number.isInteger(roundNumber) ||
      roundNumber < 1 ||
      !Number.isInteger(courtNumber) ||
      courtNumber < 1
    ) {
      return NextResponse.json(
        { error: "The event or court number is invalid." },
        { status: 400 },
      );
    }

    const { court } = await loadEditableCourt(
      eventId,
      courtNumber,
      roundNumber,
    );

    const { error: resetPlayersError } =
      await supabaseAdmin
        .from("court_players")
        .update({ team_number: null })
        .eq("court_id", court.id);

    if (resetPlayersError) {
      throw resetPlayersError;
    }

    const { error: resetCourtError } = await supabaseAdmin
      .from("courts")
      .update({ pairing_index: null })
      .eq("id", court.id);

    if (resetCourtError) {
      throw resetCourtError;
    }

    return NextResponse.json({ undone: true });
  } catch (error) {
    console.error("Unable to undo court pairing:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to undo the court pairing.",
      },
      { status: 500 },
    );
  }
}
