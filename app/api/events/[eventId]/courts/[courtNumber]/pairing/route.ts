
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
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

function errorResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Unable to process court pairing.";

  if (message === "AUTH_REQUIRED") {
    return NextResponse.json(
      { error: "Please log in to continue." },
      { status: 401 },
    );
  }

  if (message === "STAFF_ACCESS_DENIED") {
    return NextResponse.json(
      { error: "Staff access is required." },
      { status: 403 },
    );
  }

  if (message === "STAFF_CHECK_FAILED") {
    return NextResponse.json(
      { error: "Unable to verify staff permissions." },
      { status: 500 },
    );
  }

  console.error("Court pairing error:", error);

  return NextResponse.json(
    { error: message },
    { status: 500 },
  );
}

function validateNumbers(
  eventId: string,
  courtNumber: number,
  roundNumber: number,
) {
  return (
    Boolean(eventId) &&
    Number.isInteger(courtNumber) &&
    courtNumber > 0 &&
    Number.isInteger(roundNumber) &&
    roundNumber > 0
  );
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

  if (roundNumber !== event.current_round) {
    throw new Error(
      "Team changes are only allowed in the current round.",
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

  return { round, court };
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    await requireStaffUser();

    const { eventId, courtNumber: courtNumberText } =
      await context.params;

    const courtNumber = Number(courtNumberText);
    const body = (await request.json()) as SavePairingRequest;
    const roundNumber = Number(body.roundNumber);
    const team1PlayerIds = body.team1PlayerIds ?? [];

    if (!validateNumbers(eventId, courtNumber, roundNumber)) {
      return NextResponse.json(
        { error: "The event or court number is invalid." },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(team1PlayerIds) ||
      team1PlayerIds.length !== 2 ||
      !team1PlayerIds.every(
        (id) => typeof id === "string",
      ) ||
      new Set(team1PlayerIds).size !== 2
    ) {
      return NextResponse.json(
        { error: "Choose two different Team 1 players." },
        { status: 400 },
      );
    }

    const { round, court } = await loadEditableCourt(
      eventId,
      courtNumber,
      roundNumber,
    );

    if (court.complete) {
      return NextResponse.json(
        {
          error:
            "Use Correct Teams before changing a completed court.",
        },
        { status: 409 },
      );
    }

    const { data: courtPlayers, error: courtPlayersError } =
      await supabaseAdmin
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
      (player) => player.event_player_id,
    );

    const { data: eventPlayers, error: eventPlayersError } =
      await supabaseAdmin
        .from("event_players")
        .select("id, player_id")
        .in("id", eventPlayerIds);

    if (eventPlayersError) {
      throw eventPlayersError;
    }

    const playerIdByEventPlayerId = new Map(
      (eventPlayers ?? []).map((player) => [
        player.id,
        player.player_id,
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
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  try {
    await requireStaffUser();

    const { eventId, courtNumber: courtNumberText } =
      await context.params;

    const courtNumber = Number(courtNumberText);
    const roundNumber = Number(
      new URL(request.url).searchParams.get("roundNumber"),
    );

    if (!validateNumbers(eventId, courtNumber, roundNumber)) {
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

    if (court.complete) {
      return NextResponse.json(
        {
          error:
            "This court has a saved score. Use Correct Teams.",
        },
        { status: 409 },
      );
    }

    const { error: resetError } = await supabaseAdmin.rpc(
      "reset_court_for_team_correction",
      {
        p_event_id: eventId,
        p_round_number: roundNumber,
        p_court_number: courtNumber,
      },
    );

    if (resetError) {
      throw resetError;
    }

    return NextResponse.json({ undone: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    await requireStaffUser();

    const { eventId, courtNumber: courtNumberText } =
      await context.params;

    const courtNumber = Number(courtNumberText);
    const body = (await request.json()) as {
      roundNumber?: number;
    };
    const roundNumber = Number(body.roundNumber);

    if (!validateNumbers(eventId, courtNumber, roundNumber)) {
      return NextResponse.json(
        { error: "The event or court number is invalid." },
        { status: 400 },
      );
    }

    await loadEditableCourt(
      eventId,
      courtNumber,
      roundNumber,
    );

    const { error: resetError } = await supabaseAdmin.rpc(
      "reset_court_for_team_correction",
      {
        p_event_id: eventId,
        p_round_number: roundNumber,
        p_court_number: courtNumber,
      },
    );

    if (resetError) {
      throw resetError;
    }

    return NextResponse.json({
      corrected: true,
      message:
        `Court ${courtNumber} score and pairing cleared. Select the correct teams and enter the score again.`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
