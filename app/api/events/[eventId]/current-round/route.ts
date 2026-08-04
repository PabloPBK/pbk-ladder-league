import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(
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
          "id, name, event_date, status, current_round",
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

    const { data: round, error: roundError } =
      await supabaseAdmin
        .from("rounds")
        .select(
          "id, event_id, round_number, status",
        )
        .eq("event_id", eventId)
        .order("round_number", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (roundError) {
      throw roundError;
    }

    if (!round) {
      return NextResponse.json(
        {
          error:
            "No saved round was found for this league event.",
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
          "id, round_id, court_number, complete",
        )
        .eq("round_id", round.id)
        .order("court_number", {
          ascending: true,
        });

    if (courtsError) {
      throw courtsError;
    }

    const savedCourts = courts ?? [];

    if (savedCourts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No courts were found for the current round.",
        },
        {
          status: 404,
        },
      );
    }

    const courtIds = savedCourts.map(
      (court) => court.id,
    );

    const {
      data: courtPlayers,
      error: courtPlayersError,
    } = await supabaseAdmin
      .from("court_players")
      .select(
        "id, court_id, event_player_id, slot_number, team_number",
      )
      .in("court_id", courtIds)
      .order("slot_number", {
        ascending: true,
      });

    if (courtPlayersError) {
      throw courtPlayersError;
    }

    const savedCourtPlayers = courtPlayers ?? [];

    const eventPlayerIds = [
      ...new Set(
        savedCourtPlayers.map(
          (courtPlayer) =>
            courtPlayer.event_player_id,
        ),
      ),
    ];

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

    const playerIds = [
      ...new Set(
        (eventPlayers ?? []).map(
          (eventPlayer) => eventPlayer.player_id,
        ),
      ),
    ];

    const { data: players, error: playersError } =
      await supabaseAdmin
        .from("players")
        .select("id, name, dupr")
        .in("id", playerIds);

    if (playersError) {
      throw playersError;
    }

    const playerById = new Map(
      (players ?? []).map((player) => [
        player.id,
        player,
      ]),
    );

    const responseCourts = savedCourts.map(
      (court) => {
        const assignments = savedCourtPlayers
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
              slotNumber:
                courtPlayer.slot_number,
              teamNumber:
                courtPlayer.team_number,
            };
          });

        return {
          databaseCourtId: court.id,
          courtNumber: court.court_number,
          complete: court.complete,
          players: assignments,
        };
      },
    );

    return NextResponse.json({
      event,
      round,
      courts: responseCourts,
    });
  } catch (error) {
    console.error(
      "Unable to load current round:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the current round.",
      },
      {
        status: 500,
      },
    );
  }
}