import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
    courtNumber: string;
  }>;
};

type SavePairingRequest = {
  pairingIndex?: number;
};

const pairingTeams: Record<number, Record<number, 1 | 2>> = {
  0: {
    1: 1,
    2: 1,
    3: 2,
    4: 2,
  },
  1: {
    1: 1,
    2: 2,
    3: 1,
    4: 2,
  },
  2: {
    1: 1,
    2: 2,
    3: 2,
    4: 1,
  },
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { eventId, courtNumber: courtNumberText } =
      await context.params;

    const body =
      (await request.json()) as SavePairingRequest;

    const courtNumber = Number(courtNumberText);
    const pairingIndex = body.pairingIndex;

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
      pairingIndex === undefined ||
      !Number.isInteger(pairingIndex) ||
      !pairingTeams[pairingIndex]
    ) {
      return NextResponse.json(
        {
          error: "The selected pairing is invalid.",
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
            "Pairings cannot be changed for a completed event.",
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
        .select("id, court_number, complete")
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

    if (court.complete) {
      return NextResponse.json(
        {
          error:
            "The pairing cannot be changed after the court is completed.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: courtPlayers,
      error: courtPlayersError,
    } = await supabaseAdmin
      .from("court_players")
      .select("id, slot_number")
      .eq("court_id", court.id)
      .order("slot_number", {
        ascending: true,
      });

    if (courtPlayersError) {
      throw courtPlayersError;
    }

    if (!courtPlayers || courtPlayers.length !== 4) {
      return NextResponse.json(
        {
          error: `Court ${courtNumber} must have four assigned players.`,
        },
        {
          status: 400,
        },
      );
    }

    const teamBySlot = pairingTeams[pairingIndex];

    const updates = courtPlayers.map(
      async (courtPlayer) => {
        const teamNumber =
          teamBySlot[courtPlayer.slot_number];

        if (!teamNumber) {
          throw new Error(
            `Slot ${courtPlayer.slot_number} is invalid.`,
          );
        }

        const { error } = await supabaseAdmin
          .from("court_players")
          .update({
            team_number: teamNumber,
          })
          .eq("id", courtPlayer.id);

        if (error) {
          throw error;
        }
      },
    );

    await Promise.all(updates);

    return NextResponse.json({
      pairing: {
        eventId,
        roundNumber: round.round_number,
        courtNumber,
        pairingIndex,
      },
    });
  } catch (error) {
    console.error(
      "Unable to save court pairing:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the court pairing.",
      },
      {
        status: 500,
      },
    );
  }
}