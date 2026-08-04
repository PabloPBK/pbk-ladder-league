import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

type RoundRecord = {
  id: string;
  event_id: string;
  round_number: number;
  status: string;
};

type CourtRecord = {
  id: string;
  round_id: string;
  court_number: number;
  pairing_index: number | null;
  team_1_score: number | null;
  team_2_score: number | null;
  winner_team: number | null;
  complete: boolean;
  completed_at: string | null;
};

type EventPlayerRecord = {
  id: string;
  event_id: string;
  player_id: string;
};

type CourtPlayerRecord = {
  court_id: string;
  event_player_id: string;
  slot_number: number;
  team_number: number | null;
};

type PlayerRecord = {
  id: string;
  name: string;
  dupr: number;
};

type StandingRow = {
  playerId: string;
  name: string;
  dupr: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
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
          error:
            "A league event ID is required.",
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
      .select(
        "id, season_id, event_date, name, status, current_round",
      )
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        {
          error:
            "The league event was not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (event.status !== "complete") {
      return NextResponse.json(
        {
          error:
            "This league event is not complete yet.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: roundData,
      error: roundsError,
    } = await supabaseAdmin
      .from("rounds")
      .select(
        "id, event_id, round_number, status",
      )
      .eq("event_id", eventId)
      .order("round_number", {
        ascending: true,
      });

    if (roundsError) {
      throw roundsError;
    }

    const rounds =
      (roundData ?? []) as RoundRecord[];

    const roundIds = rounds.map(
      (round) => round.id,
    );

    let courts: CourtRecord[] = [];

    if (roundIds.length > 0) {
      const {
        data: courtData,
        error: courtsError,
      } = await supabaseAdmin
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
        .in("round_id", roundIds);

      if (courtsError) {
        throw courtsError;
      }

      courts =
        (courtData ?? []) as CourtRecord[];
    }

    const {
      data: eventPlayerData,
      error: eventPlayersError,
    } = await supabaseAdmin
      .from("event_players")
      .select("id, event_id, player_id")
      .eq("event_id", eventId);

    if (eventPlayersError) {
      throw eventPlayersError;
    }

    const eventPlayers =
      (eventPlayerData ??
        []) as EventPlayerRecord[];

    const playerIds = [
      ...new Set(
        eventPlayers.map(
          (eventPlayer) =>
            eventPlayer.player_id,
        ),
      ),
    ];

    let players: PlayerRecord[] = [];

    if (playerIds.length > 0) {
      const {
        data: playerData,
        error: playersError,
      } = await supabaseAdmin
        .from("players")
        .select("id, name, dupr")
        .in("id", playerIds);

      if (playersError) {
        throw playersError;
      }

      players =
        (playerData ?? []) as PlayerRecord[];
    }

    const courtIds = courts.map(
      (court) => court.id,
    );

    let courtPlayers: CourtPlayerRecord[] = [];

    if (courtIds.length > 0) {
      const {
        data: courtPlayerData,
        error: courtPlayersError,
      } = await supabaseAdmin
        .from("court_players")
        .select(
          "court_id, event_player_id, slot_number, team_number",
        )
        .in("court_id", courtIds);

      if (courtPlayersError) {
        throw courtPlayersError;
      }

      courtPlayers =
        (courtPlayerData ??
          []) as CourtPlayerRecord[];
    }

    const playerById = new Map(
      players.map((player) => [
        player.id,
        player,
      ]),
    );

    const eventPlayerById = new Map(
      eventPlayers.map((eventPlayer) => [
        eventPlayer.id,
        eventPlayer,
      ]),
    );

    const standingsByPlayerId =
      new Map<string, StandingRow>();

    eventPlayers.forEach((eventPlayer) => {
      const player = playerById.get(
        eventPlayer.player_id,
      );

      if (!player) {
        return;
      }

      standingsByPlayerId.set(player.id, {
        playerId: player.id,
        name: player.name,
        dupr: Number(player.dupr),
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
      });
    });

    courts.forEach((court) => {
      if (
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

      const assignments =
        courtPlayers.filter(
          (courtPlayer) =>
            courtPlayer.court_id === court.id,
        );

      assignments.forEach((assignment) => {
        if (
          assignment.team_number !== 1 &&
          assignment.team_number !== 2
        ) {
          return;
        }

        const eventPlayer =
          eventPlayerById.get(
            assignment.event_player_id,
          );

        if (!eventPlayer) {
          return;
        }

        const standing =
          standingsByPlayerId.get(
            eventPlayer.player_id,
          );

        if (!standing) {
          return;
        }

        const isTeam1 =
          assignment.team_number === 1;

        const pointsFor = isTeam1
          ? team1Score
          : team2Score;

        const pointsAgainst = isTeam1
          ? team2Score
          : team1Score;

        const won =
          assignment.team_number ===
          winnerTeam;

        standing.gamesPlayed += 1;
        standing.wins += won ? 1 : 0;
        standing.losses += won ? 0 : 1;
        standing.pointsFor += pointsFor;
        standing.pointsAgainst +=
          pointsAgainst;
        standing.pointDifferential +=
          pointsFor - pointsAgainst;
      });
    });

    const standings = [
      ...standingsByPlayerId.values(),
    ]
      .sort((playerA, playerB) => {
        if (playerB.wins !== playerA.wins) {
          return playerB.wins - playerA.wins;
        }

        if (
          playerB.pointDifferential !==
          playerA.pointDifferential
        ) {
          return (
            playerB.pointDifferential -
            playerA.pointDifferential
          );
        }

        if (
          playerB.pointsFor !==
          playerA.pointsFor
        ) {
          return (
            playerB.pointsFor -
            playerA.pointsFor
          );
        }

        return playerA.name.localeCompare(
          playerB.name,
        );
      })
      .map((standing, index) => ({
        rank: index + 1,
        ...standing,
      }));

    const historyRounds = rounds.map(
      (round) => {
        const roundCourts = courts
          .filter(
            (court) =>
              court.round_id === round.id,
          )
          .sort(
            (courtA, courtB) =>
              courtA.court_number -
              courtB.court_number,
          )
          .map((court) => {
            const assignments =
              courtPlayers
                .filter(
                  (courtPlayer) =>
                    courtPlayer.court_id ===
                    court.id,
                )
                .sort(
                  (playerA, playerB) =>
                    playerA.slot_number -
                    playerB.slot_number,
                )
                .map((courtPlayer) => {
                  const eventPlayer =
                    eventPlayerById.get(
                      courtPlayer.event_player_id,
                    );

                  const player = eventPlayer
                    ? playerById.get(
                        eventPlayer.player_id,
                      )
                    : undefined;

                  if (!player) {
                    throw new Error(
                      `A player assigned to Court ${court.court_number} could not be found.`,
                    );
                  }

                  return {
                    playerId: player.id,
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
              courtNumber:
                court.court_number,
              pairingIndex:
                court.pairing_index,
              team1Score:
                court.team_1_score,
              team2Score:
                court.team_2_score,
              winnerTeam:
                court.winner_team,
              complete:
                Boolean(court.complete),
              completedAt:
                court.completed_at,
              team1: assignments.filter(
                (assignment) =>
                  assignment.teamNumber === 1,
              ),
              team2: assignments.filter(
                (assignment) =>
                  assignment.teamNumber === 2,
              ),
            };
          });

        return {
          id: round.id,
          roundNumber: round.round_number,
          status: round.status,
          courts: roundCourts,
        };
      },
    );

    return NextResponse.json({
      event: {
        id: event.id,
        seasonId: event.season_id,
        eventDate: event.event_date,
        name: event.name,
        status: event.status,
        roundCount: historyRounds.length,
        playerCount: eventPlayers.length,
      },
      standings,
      rounds: historyRounds,
    });
  } catch (error) {
    console.error(
      "Unable to load league-night history:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load league-night history.",
      },
      {
        status: 500,
      },
    );
  }
}