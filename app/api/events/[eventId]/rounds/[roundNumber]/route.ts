import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
    roundNumber: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const {
      eventId,
      roundNumber: roundNumberText,
    } = await context.params;

    const roundNumber = Number(roundNumberText);

    if (
      !eventId ||
      !Number.isInteger(roundNumber) ||
      roundNumber < 1
    ) {
      return NextResponse.json(
        {
          error:
            "The league event ID or round number is invalid.",
        },
        { status: 400 },
      );
    }

    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select(
          "id, name, event_date, status, current_round",
        )
        .eq("id", eventId)
        .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "The league event was not found." },
        { status: 404 },
      );
    }

    const {
      data: allRounds,
      error: allRoundsError,
    } = await supabaseAdmin
      .from("rounds")
      .select("id, event_id, round_number, status")
      .eq("event_id", eventId)
      .order("round_number", { ascending: true });

    if (allRoundsError) {
      throw allRoundsError;
    }

    const round = (allRounds ?? []).find(
      (candidate) =>
        candidate.round_number === roundNumber,
    );

    if (!round) {
      return NextResponse.json(
        {
          error: `Round ${roundNumber} was not found.`,
        },
        { status: 404 },
      );
    }

    const { data: courts, error: courtsError } =
      await supabaseAdmin
        .from("courts")
        .select(
          `
          id,
          round_id,
          court_number,
          pairing_index,
          team_1_score,
          team_2_score,
          winner_team,
          complete,
          completed_at
          `,
        )
        .eq("round_id", round.id)
        .order("court_number", { ascending: true });

    if (courtsError) {
      throw courtsError;
    }

    const savedCourts = courts ?? [];
    const courtIds = savedCourts.map(
      (court) => court.id,
    );

    let courtPlayers: {
      court_id: string;
      event_player_id: string;
      slot_number: number;
      team_number: number | null;
    }[] = [];

    if (courtIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("court_players")
        .select(
          "court_id, event_player_id, slot_number, team_number",
        )
        .in("court_id", courtIds)
        .order("slot_number", { ascending: true });

      if (error) {
        throw error;
      }

      courtPlayers = data ?? [];
    }

    const eventPlayerIds = [
      ...new Set(
        courtPlayers.map(
          (courtPlayer) =>
            courtPlayer.event_player_id,
        ),
      ),
    ];

    let eventPlayers: {
      id: string;
      player_id: string;
    }[] = [];

    if (eventPlayerIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("event_players")
        .select("id, player_id")
        .in("id", eventPlayerIds);

      if (error) {
        throw error;
      }

      eventPlayers = data ?? [];
    }

    const playerIdByEventPlayerId = new Map(
      eventPlayers.map((eventPlayer) => [
        eventPlayer.id,
        eventPlayer.player_id,
      ]),
    );

    const playerIds = [
      ...new Set(
        eventPlayers.map(
          (eventPlayer) => eventPlayer.player_id,
        ),
      ),
    ];

    let players: {
      id: string;
      name: string;
      dupr: number;
    }[] = [];

    if (playerIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("players")
        .select("id, name, dupr")
        .in("id", playerIds);

      if (error) {
        throw error;
      }

      players = data ?? [];
    }

    const playerById = new Map(
      players.map((player) => [player.id, player]),
    );

    const responseCourts = savedCourts.map(
      (court) => {
        const assignments = courtPlayers
          .filter(
            (courtPlayer) =>
              courtPlayer.court_id === court.id,
          )
          .sort(
            (playerA, playerB) =>
              playerA.slot_number -
              playerB.slot_number,
          )
          .map((courtPlayer) => {
            const playerId =
              playerIdByEventPlayerId.get(
                courtPlayer.event_player_id,
              );

            const player = playerId
              ? playerById.get(playerId)
              : undefined;

            if (!player) {
              throw new Error(
                `A player assigned to Court ${court.court_number} could not be found.`,
              );
            }

            return {
              databasePlayerId: player.id,
              name: player.name,
              dupr: Number(player.dupr),
              slotNumber: courtPlayer.slot_number,
              teamNumber: courtPlayer.team_number,
            };
          });

        return {
          databaseCourtId: court.id,
          courtNumber: court.court_number,
          pairingIndex: court.pairing_index,
          team1Score: court.team_1_score,
          team2Score: court.team_2_score,
          winnerTeam: court.winner_team,
          complete: Boolean(court.complete),
          completedAt: court.completed_at,
          players: assignments,
        };
      },
    );

    return NextResponse.json({
      event,
      round,
      courts: responseCourts,
      availableRounds: (allRounds ?? []).map(
        (savedRound) => savedRound.round_number,
      ),
    });
  } catch (error) {
    console.error("Unable to load saved round:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the saved round.",
      },
      { status: 500 },
    );
  }
}
