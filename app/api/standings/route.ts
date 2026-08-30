import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type EventRecord = {
  id: string;
};

type RoundRecord = {
  id: string;
  event_id: string;
};

type CourtRecord = {
  id: string;
  round_id: string;
  team_1_score: number | null;
  team_2_score: number | null;
  winner_team: number | null;
  complete: boolean;
};

type EventPlayerRecord = {
  id: string;
  event_id: string;
  player_id: string;
};

type CourtPlayerRecord = {
  court_id: string;
  event_player_id: string;
  team_number: number | null;
};

type PlayerRecord = {
  id: string;
  name: string;
  dupr: number | string;
};

type StandingAccumulator = {
  playerId: string;
  name: string;
  dupr: number;
  eventIds: Set<string>;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

/*
 * court_players can easily exceed the normal
 * Supabase/PostgREST row limit during a season.
 *
 * Example:
 *
 * 48 players
 * × 6 rounds
 * × 5 league nights
 * = 1,440 court-player assignments
 *
 * Therefore we query court IDs in smaller groups
 * instead of trying to load the whole season's
 * assignments in one request.
 */
function chunkArray<T>(
  values: T[],
  size: number,
): T[][] {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(index, index + size),
    );
  }

  return chunks;
}

export async function GET(
  request: Request,
) {
  try {
    const url =
      new URL(request.url);

    const seasonId =
      url.searchParams
        .get("seasonId")
        ?.trim() ?? "";

    if (!seasonId) {
      return NextResponse.json(
        {
          error:
            "A season ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------
     * 1. COMPLETED EVENTS IN THIS SEASON
     * --------------------------------------------------
     */
    const {
      data: eventData,
      error: eventsError,
    } = await supabaseAdmin
      .from("league_events")
      .select("id")
      .eq(
        "season_id",
        seasonId,
      )
      .eq(
        "status",
        "complete",
      );

    if (eventsError) {
      throw eventsError;
    }

    const events =
      (eventData ?? []) as EventRecord[];

    if (events.length === 0) {
      return NextResponse.json(
        {
          seasonId,
          completedEventCount: 0,
          standings: [],
        },
        {
          status: 200,
        },
      );
    }

    const eventIds =
      events.map(
        (event) => event.id,
      );

    /*
     * --------------------------------------------------
     * 2. ALL ROUNDS FROM COMPLETED EVENTS
     * --------------------------------------------------
     */
    const {
      data: roundData,
      error: roundsError,
    } = await supabaseAdmin
      .from("rounds")
      .select(
        "id, event_id",
      )
      .in(
        "event_id",
        eventIds,
      );

    if (roundsError) {
      throw roundsError;
    }

    const rounds =
      (roundData ?? []) as RoundRecord[];

    const roundIds =
      rounds.map(
        (round) => round.id,
      );

    /*
     * --------------------------------------------------
     * 3. COMPLETED COURTS
     * --------------------------------------------------
     */
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
          team_1_score,
          team_2_score,
          winner_team,
          complete
          `,
        )
        .in(
          "round_id",
          roundIds,
        )
        .eq(
          "complete",
          true,
        );

      if (courtsError) {
        throw courtsError;
      }

      courts =
        (courtData ??
          []) as CourtRecord[];
    }

    /*
     * --------------------------------------------------
     * 4. EVENT PLAYER RECORDS
     * --------------------------------------------------
     */
    const {
      data: eventPlayerData,
      error: eventPlayersError,
    } = await supabaseAdmin
      .from("event_players")
      .select(
        "id, event_id, player_id",
      )
      .in(
        "event_id",
        eventIds,
      );

    if (eventPlayersError) {
      throw eventPlayersError;
    }

    const eventPlayers =
      (eventPlayerData ??
        []) as EventPlayerRecord[];

    /*
     * --------------------------------------------------
     * 5. PERMANENT PLAYER RECORDS
     * --------------------------------------------------
     */
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
        .select(
          "id, name, dupr",
        )
        .in(
          "id",
          playerIds,
        );

      if (playersError) {
        throw playersError;
      }

      players =
        (playerData ??
          []) as PlayerRecord[];
    }

    /*
     * --------------------------------------------------
     * 6. COURT PLAYER ASSIGNMENTS
     * --------------------------------------------------
     *
     * IMPORTANT FIX:
     *
     * Do NOT request every court_player for the
     * entire season in a single Supabase query.
     *
     * A normal season can exceed 1,000 rows.
     *
     * Instead, request assignments in batches of
     * 200 courts.
     *
     * 200 courts × 4 players = about 800 records,
     * safely below the normal response limit.
     */
    const courtIds =
      courts.map(
        (court) => court.id,
      );

    const courtPlayers:
      CourtPlayerRecord[] = [];

    const courtIdChunks =
      chunkArray(
        courtIds,
        200,
      );

    for (
      const courtIdChunk
      of courtIdChunks
    ) {
      const {
        data: courtPlayerData,
        error: courtPlayersError,
      } = await supabaseAdmin
        .from("court_players")
        .select(
          `
          court_id,
          event_player_id,
          team_number
          `,
        )
        .in(
          "court_id",
          courtIdChunk,
        );

      if (courtPlayersError) {
        throw courtPlayersError;
      }

      courtPlayers.push(
        ...(
          (courtPlayerData ??
            []) as CourtPlayerRecord[]
        ),
      );
    }

    /*
     * --------------------------------------------------
     * 7. LOOKUP MAPS
     * --------------------------------------------------
     */
    const playerById =
      new Map(
        players.map(
          (player) => [
            player.id,
            player,
          ],
        ),
      );

    const eventPlayerById =
      new Map(
        eventPlayers.map(
          (eventPlayer) => [
            eventPlayer.id,
            eventPlayer,
          ],
        ),
      );

    const eventIdByRoundId =
      new Map(
        rounds.map(
          (round) => [
            round.id,
            round.event_id,
          ],
        ),
      );

    const assignmentsByCourtId =
      new Map<
        string,
        CourtPlayerRecord[]
      >();

    courtPlayers.forEach(
      (assignment) => {
        const existing =
          assignmentsByCourtId.get(
            assignment.court_id,
          ) ?? [];

        existing.push(
          assignment,
        );

        assignmentsByCourtId.set(
          assignment.court_id,
          existing,
        );
      },
    );

    /*
     * --------------------------------------------------
     * 8. INITIALIZE SEASON STANDINGS
     * --------------------------------------------------
     */
    const standingsByPlayerId =
      new Map<
        string,
        StandingAccumulator
      >();

    eventPlayers.forEach(
      (eventPlayer) => {
        const player =
          playerById.get(
            eventPlayer.player_id,
          );

        if (!player) {
          return;
        }

        const existing =
          standingsByPlayerId.get(
            player.id,
          );

        if (existing) {
          existing.eventIds.add(
            eventPlayer.event_id,
          );

          return;
        }

        standingsByPlayerId.set(
          player.id,
          {
            playerId:
              player.id,

            name:
              player.name,

            dupr:
              Number(
                player.dupr,
              ),

            eventIds:
              new Set([
                eventPlayer.event_id,
              ]),

            wins: 0,
            losses: 0,
            pointsFor: 0,
            pointsAgainst: 0,
          },
        );
      },
    );

    /*
     * --------------------------------------------------
     * 9. CALCULATE EVERY COMPLETED GAME
     * --------------------------------------------------
     */
    courts.forEach(
      (court) => {
        if (
          court.team_1_score ===
            null ||
          court.team_2_score ===
            null
        ) {
          return;
        }

        const eventId =
          eventIdByRoundId.get(
            court.round_id,
          );

        if (!eventId) {
          return;
        }

        const team1Score =
          Number(
            court.team_1_score,
          );

        const team2Score =
          Number(
            court.team_2_score,
          );

        const winnerTeam =
          court.winner_team ??
          (
            team1Score >
            team2Score
              ? 1
              : 2
          );

        const assignments =
          assignmentsByCourtId.get(
            court.id,
          ) ?? [];

        assignments.forEach(
          (assignment) => {
            if (
              assignment.team_number !==
                1 &&
              assignment.team_number !==
                2
            ) {
              return;
            }

            const eventPlayer =
              eventPlayerById.get(
                assignment.event_player_id,
              );

            if (
              !eventPlayer ||
              eventPlayer.event_id !==
                eventId
            ) {
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
              assignment.team_number ===
              1;

            const pointsFor =
              isTeam1
                ? team1Score
                : team2Score;

            const pointsAgainst =
              isTeam1
                ? team2Score
                : team1Score;

            const won =
              assignment.team_number ===
              winnerTeam;

            standing.wins +=
              won ? 1 : 0;

            standing.losses +=
              won ? 0 : 1;

            standing.pointsFor +=
              pointsFor;

            standing.pointsAgainst +=
              pointsAgainst;
          },
        );
      },
    );

    /*
     * --------------------------------------------------
     * 10. FINAL STANDINGS
     * --------------------------------------------------
     */
    const standings = [
      ...standingsByPlayerId.values(),
    ]
      .map(
        (standing) => {
          const gamesPlayed =
            standing.wins +
            standing.losses;

          const pointDifferential =
            standing.pointsFor -
            standing.pointsAgainst;

          return {
            playerId:
              standing.playerId,

            name:
              standing.name,

            dupr:
              standing.dupr,

            leagueNights:
              standing.eventIds.size,

            gamesPlayed,

            wins:
              standing.wins,

            losses:
              standing.losses,

            winPercentage:
              gamesPlayed > 0
                ? Number(
                    (
                      (
                        standing.wins /
                        gamesPlayed
                      ) *
                      100
                    ).toFixed(
                      1,
                    ),
                  )
                : 0,

            pointsFor:
              standing.pointsFor,

            pointsAgainst:
              standing.pointsAgainst,

            pointDifferential,
          };
        },
      )
      .filter(
        (standing) =>
          standing.gamesPlayed >
          0,
      )

      /*
       * Ranking:
       *
       * 1. Wins
       * 2. Point differential
       * 3. Win percentage
       * 4. DUPR
       * 5. Name
       */
      .sort(
        (
          playerA,
          playerB,
        ) => {
          if (
            playerB.wins !==
            playerA.wins
          ) {
            return (
              playerB.wins -
              playerA.wins
            );
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
            playerB.winPercentage !==
            playerA.winPercentage
          ) {
            return (
              playerB.winPercentage -
              playerA.winPercentage
            );
          }

          if (
            playerB.dupr !==
            playerA.dupr
          ) {
            return (
              playerB.dupr -
              playerA.dupr
            );
          }

          return (
            playerA.name.localeCompare(
              playerB.name,
            )
          );
        },
      )
      .map(
        (
          standing,
          index,
        ) => ({
          rank:
            index + 1,

          ...standing,
        }),
      );

    return NextResponse.json(
      {
        seasonId,

        completedEventCount:
          events.length,

        /*
         * Useful diagnostic values.
         *
         * These make it easier to detect a
         * truncated query in the future.
         */
        completedCourtCount:
          courts.length,

        courtPlayerAssignmentCount:
          courtPlayers.length,

        standings,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Unable to load cumulative standings:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load cumulative standings.",
      },
      {
        status: 500,
      },
    );
  }
}