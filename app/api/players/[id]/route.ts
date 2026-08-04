import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type EventPlayerRecord = {
  id: string;
  event_id: string;
};

type CourtPlayerRecord = {
  court_id: string;
  event_player_id: string;
  team_number: number | null;
};

type CourtRecord = {
  id: string;
  team_1_score: number | null;
  team_2_score: number | null;
  winner_team: number | null;
  complete: boolean;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id: playerId } =
      await context.params;

    if (!playerId) {
      return NextResponse.json(
        {
          error: "A player ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: player,
      error: playerError,
    } = await supabaseAdmin
      .from("players")
      .select("id, name, dupr")
      .eq("id", playerId)
      .maybeSingle();

    if (playerError) {
      throw playerError;
    }

    if (!player) {
      return NextResponse.json(
        {
          error: "Player not found.",
        },
        {
          status: 404,
        },
      );
    }

    const {
      data: eventPlayerData,
      error: eventPlayersError,
    } = await supabaseAdmin
      .from("event_players")
      .select("id, event_id")
      .eq("player_id", playerId);

    if (eventPlayersError) {
      throw eventPlayersError;
    }

    const eventPlayers =
      (eventPlayerData ??
        []) as EventPlayerRecord[];

    const eventPlayerIds = eventPlayers.map(
      (eventPlayer) => eventPlayer.id,
    );

    let courtPlayers: CourtPlayerRecord[] =
      [];

    if (eventPlayerIds.length > 0) {
      const {
        data: courtPlayerData,
        error: courtPlayersError,
      } = await supabaseAdmin
        .from("court_players")
        .select(
          "court_id, event_player_id, team_number",
        )
        .in(
          "event_player_id",
          eventPlayerIds,
        );

      if (courtPlayersError) {
        throw courtPlayersError;
      }

      courtPlayers =
        (courtPlayerData ??
          []) as CourtPlayerRecord[];
    }

    const courtIds = [
      ...new Set(
        courtPlayers.map(
          (courtPlayer) =>
            courtPlayer.court_id,
        ),
      ),
    ];

    let courts: CourtRecord[] = [];

    if (courtIds.length > 0) {
      const {
        data: courtData,
        error: courtsError,
      } = await supabaseAdmin
        .from("courts")
        .select(
          `
          id,
          team_1_score,
          team_2_score,
          winner_team,
          complete
          `,
        )
        .in("id", courtIds);

      if (courtsError) {
        throw courtsError;
      }

      courts =
        (courtData ?? []) as CourtRecord[];
    }

    const courtById = new Map(
      courts.map((court) => [
        court.id,
        court,
      ]),
    );

    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    courtPlayers.forEach((assignment) => {
      if (
        assignment.team_number !== 1 &&
        assignment.team_number !== 2
      ) {
        return;
      }

      const court = courtById.get(
        assignment.court_id,
      );

      if (
        !court ||
        !court.complete ||
        court.team_1_score === null ||
        court.team_2_score === null
      ) {
        return;
      }

      const team1Score = Number(
        court.team_1_score,
      );

      const team2Score = Number(
        court.team_2_score,
      );

      const winnerTeam =
        court.winner_team ??
        (team1Score > team2Score ? 1 : 2);

      const isTeam1 =
        assignment.team_number === 1;

      const playerPointsFor = isTeam1
        ? team1Score
        : team2Score;

      const playerPointsAgainst = isTeam1
        ? team2Score
        : team1Score;

      const won =
        assignment.team_number ===
        winnerTeam;

      wins += won ? 1 : 0;
      losses += won ? 0 : 1;
      pointsFor += playerPointsFor;
      pointsAgainst +=
        playerPointsAgainst;
    });

    const gamesPlayed = wins + losses;

    const leagueNights = new Set(
      eventPlayers.map(
        (eventPlayer) =>
          eventPlayer.event_id,
      ),
    ).size;

    return NextResponse.json(
      {
        player: {
          id: player.id,
          name: player.name,
          dupr: Number(player.dupr),
          leagueNights,
          gamesPlayed,
          wins,
          losses,
          winPercentage:
            gamesPlayed > 0
              ? Number(
                  (
                    (wins / gamesPlayed) *
                    100
                  ).toFixed(1),
                )
              : 0,
          pointsFor,
          pointsAgainst,
          pointDifferential:
            pointsFor - pointsAgainst,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Unable to load player profile:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load player.",
      },
      {
        status: 500,
      },
    );
  }
}