import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

type StandingRow = {
  playerId: string;
  name: string;
  dupr: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
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
          error: "A league event ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Load the active event.
     */
    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select(
          "id, season_id, name, event_date, status, current_round",
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

    /*
     * Load the event's current round.
     */
    const { data: round, error: roundError } =
      await supabaseAdmin
        .from("rounds")
        .select(
          "id, event_id, round_number, status",
        )
        .eq("event_id", event.id)
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

    /*
     * Load the current round's courts and scores.
     */
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
        .order("court_number", {
          ascending: true,
        });

    if (courtsError) {
      throw courtsError;
    }

    const savedCourts = courts ?? [];

    const currentCourtIds = savedCourts.map(
      (court) => court.id,
    );

    /*
     * Load current court assignments.
     */
    let currentCourtPlayers: {
      court_id: string;
      event_player_id: string;
      slot_number: number;
      team_number: number | null;
    }[] = [];

    if (currentCourtIds.length > 0) {
      const {
        data,
        error: currentCourtPlayersError,
      } = await supabaseAdmin
        .from("court_players")
        .select(
          "court_id, event_player_id, slot_number, team_number",
        )
        .in("court_id", currentCourtIds)
        .order("slot_number", {
          ascending: true,
        });

      if (currentCourtPlayersError) {
        throw currentCourtPlayersError;
      }

      currentCourtPlayers = data ?? [];
    }

    const currentEventPlayerIds = [
      ...new Set(
        currentCourtPlayers.map(
          (courtPlayer) =>
            courtPlayer.event_player_id,
        ),
      ),
    ];

    let currentEventPlayers: {
      id: string;
      player_id: string;
    }[] = [];

    if (currentEventPlayerIds.length > 0) {
      const {
        data,
        error: currentEventPlayersError,
      } = await supabaseAdmin
        .from("event_players")
        .select("id, player_id")
        .in("id", currentEventPlayerIds);

      if (currentEventPlayersError) {
        throw currentEventPlayersError;
      }

      currentEventPlayers = data ?? [];
    }

    const currentPlayerIdByEventPlayerId =
      new Map(
        currentEventPlayers.map(
          (eventPlayer) => [
            eventPlayer.id,
            eventPlayer.player_id,
          ],
        ),
      );

    const currentPlayerIds = [
      ...new Set(
        currentEventPlayers.map(
          (eventPlayer) =>
            eventPlayer.player_id,
        ),
      ),
    ];

    let currentPlayers: {
      id: string;
      name: string;
      dupr: number;
    }[] = [];

    if (currentPlayerIds.length > 0) {
      const {
        data,
        error: currentPlayersError,
      } = await supabaseAdmin
        .from("players")
        .select("id, name, dupr")
        .in("id", currentPlayerIds);

      if (currentPlayersError) {
        throw currentPlayersError;
      }

      currentPlayers = data ?? [];
    }

    const currentPlayerById = new Map(
      currentPlayers.map((player) => [
        player.id,
        player,
      ]),
    );

    const responseCourts = savedCourts.map(
      (court) => {
        const assignments =
          currentCourtPlayers
            .filter(
              (courtPlayer) =>
                courtPlayer.court_id === court.id,
            )
            .map((courtPlayer) => {
              const playerId =
                currentPlayerIdByEventPlayerId.get(
                  courtPlayer.event_player_id,
                );

              const player = playerId
                ? currentPlayerById.get(playerId)
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
            })
            .sort(
              (playerA, playerB) =>
                playerA.slotNumber -
                playerB.slotNumber,
            );

        return {
          databaseCourtId: court.id,
          courtNumber: court.court_number,
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
      },
    );

    /*
     * Find every event belonging to this season.
     * This keeps each league and season isolated.
     */
    const {
      data: seasonEvents,
      error: seasonEventsError,
    } = await supabaseAdmin
      .from("league_events")
      .select("id")
      .eq("season_id", event.season_id);

    if (seasonEventsError) {
      throw seasonEventsError;
    }

    const seasonEventIds = (
      seasonEvents ?? []
    ).map((seasonEvent) => seasonEvent.id);

    let seasonRounds: {
      id: string;
      event_id: string;
    }[] = [];

    if (seasonEventIds.length > 0) {
      const {
        data,
        error: seasonRoundsError,
      } = await supabaseAdmin
        .from("rounds")
        .select("id, event_id")
        .in("event_id", seasonEventIds);

      if (seasonRoundsError) {
        throw seasonRoundsError;
      }

      seasonRounds = data ?? [];
    }

    const seasonRoundIds = seasonRounds.map(
      (seasonRound) => seasonRound.id,
    );

    let completedCourts: {
      id: string;
      team_1_score: number | null;
      team_2_score: number | null;
      winner_team: number | null;
      complete: boolean;
    }[] = [];

    if (seasonRoundIds.length > 0) {
      const {
        data,
        error: completedCourtsError,
      } = await supabaseAdmin
        .from("courts")
        .select(
          "id, team_1_score, team_2_score, winner_team, complete",
        )
        .in("round_id", seasonRoundIds)
        .eq("complete", true);

      if (completedCourtsError) {
        throw completedCourtsError;
      }

      completedCourts = data ?? [];
    }

    const completedCourtIds =
      completedCourts.map(
        (completedCourt) =>
          completedCourt.id,
      );

    let seasonCourtPlayers: {
      court_id: string;
      event_player_id: string;
      team_number: number | null;
    }[] = [];

    if (completedCourtIds.length > 0) {
      const {
        data,
        error: seasonCourtPlayersError,
      } = await supabaseAdmin
        .from("court_players")
        .select(
          "court_id, event_player_id, team_number",
        )
        .in(
          "court_id",
          completedCourtIds,
        );

      if (seasonCourtPlayersError) {
        throw seasonCourtPlayersError;
      }

      seasonCourtPlayers = data ?? [];
    }

    let allSeasonEventPlayers: {
      id: string;
      event_id: string;
      player_id: string;
    }[] = [];

    if (seasonEventIds.length > 0) {
      const {
        data,
        error: allSeasonEventPlayersError,
      } = await supabaseAdmin
        .from("event_players")
        .select(
          "id, event_id, player_id",
        )
        .in("event_id", seasonEventIds);

      if (allSeasonEventPlayersError) {
        throw allSeasonEventPlayersError;
      }

      allSeasonEventPlayers = data ?? [];
    }

    const eventPlayerIdToPlayerId =
      new Map(
        allSeasonEventPlayers.map(
          (eventPlayer) => [
            eventPlayer.id,
            eventPlayer.player_id,
          ],
        ),
      );

    /*
     * Include everybody registered for this season.
     * Fall back to event participants if the
     * season_players roster is empty.
     */
    const {
      data: seasonRoster,
      error: seasonRosterError,
    } = await supabaseAdmin
      .from("season_players")
      .select("player_id")
      .eq("season_id", event.season_id);

    if (seasonRosterError) {
      throw seasonRosterError;
    }

    const rosterPlayerIds = (
      seasonRoster ?? []
    ).map((entry) => entry.player_id);

    const eventParticipantPlayerIds =
      allSeasonEventPlayers.map(
        (eventPlayer) =>
          eventPlayer.player_id,
      );

    const seasonPlayerIds = [
      ...new Set([
        ...rosterPlayerIds,
        ...eventParticipantPlayerIds,
      ]),
    ];

    let seasonPlayers: {
      id: string;
      name: string;
      dupr: number;
    }[] = [];

    if (seasonPlayerIds.length > 0) {
      const {
        data,
        error: seasonPlayersError,
      } = await supabaseAdmin
        .from("players")
        .select("id, name, dupr")
        .in("id", seasonPlayerIds);

      if (seasonPlayersError) {
        throw seasonPlayersError;
      }

      seasonPlayers = data ?? [];
    }

    const standingsByPlayerId = new Map<
      string,
      StandingRow
    >();

    seasonPlayers.forEach((player) => {
      standingsByPlayerId.set(player.id, {
        playerId: player.id,
        name: player.name,
        dupr: Number(player.dupr),
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
      });
    });

    completedCourts.forEach((court) => {
      if (
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
        seasonCourtPlayers.filter(
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

        const playerId =
          eventPlayerIdToPlayerId.get(
            assignment.event_player_id,
          );

        if (!playerId) {
          return;
        }

        const standing =
          standingsByPlayerId.get(playerId);

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
          winnerTeam ===
          assignment.team_number;

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

    const roundComplete =
      responseCourts.length > 0 &&
      responseCourts.every(
        (court) => court.complete,
      );

    return NextResponse.json({
      event,
      round,
      courts: responseCourts,
      standings,
      roundComplete,
    });
  } catch (error) {
    console.error(
      "Unable to load Match Center:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Match Center.",
      },
      {
        status: 500,
      },
    );
  }
}