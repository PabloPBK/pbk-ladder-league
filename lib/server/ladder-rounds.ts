import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CourtPlayerRecord = {
  court_id: string;
  event_player_id: string;
  slot_number: number;
  team_number: number | null;
};

type PlayerOutcome = {
  eventPlayerId: string;
  databasePlayerId: string;
};

type CourtOutcome = {
  courtNumber: number;
  winners: [PlayerOutcome, PlayerOutcome];
  losers: [PlayerOutcome, PlayerOutcome];
};

export async function generateNextRoundResponse(
  eventId: string,
) {
  let createdRoundId: string | null = null;

  try {

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
     * Load the active league event.
     */
    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("league_events")
        .select(
          "id, status, current_round",
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

    if (event.status === "complete") {
      return NextResponse.json(
        {
          error:
            "A new round cannot be created for a completed event.",
        },
        {
          status: 400,
        },
      );
    }

    const currentRoundNumber = Number(
      event.current_round,
    );

    const nextRoundNumber =
      currentRoundNumber + 1;

    /*
     * Prevent duplicate next rounds.
     */
    const {
      data: existingNextRound,
      error: existingNextRoundError,
    } = await supabaseAdmin
      .from("rounds")
      .select(
        "id, event_id, round_number, status",
      )
      .eq("event_id", eventId)
      .eq("round_number", nextRoundNumber)
      .maybeSingle();

    if (existingNextRoundError) {
      throw existingNextRoundError;
    }

    if (existingNextRound) {
      return NextResponse.json(
        {
          error: `Round ${nextRoundNumber} has already been generated.`,
          round: existingNextRound,
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Load the completed current round.
     */
    const {
      data: currentRound,
      error: currentRoundError,
    } = await supabaseAdmin
      .from("rounds")
      .select(
        "id, event_id, round_number, status",
      )
      .eq("event_id", eventId)
      .eq("round_number", currentRoundNumber)
      .single();

    if (currentRoundError || !currentRound) {
      return NextResponse.json(
        {
          error: `Round ${currentRoundNumber} was not found.`,
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Load every court and final score.
     */
    const {
      data: currentCourts,
      error: currentCourtsError,
    } = await supabaseAdmin
      .from("courts")
      .select(
        `
        id,
        court_number,
        team_1_score,
        team_2_score,
        winner_team,
        complete
        `,
      )
      .eq("round_id", currentRound.id)
      .order("court_number", {
        ascending: true,
      });

    if (currentCourtsError) {
      throw currentCourtsError;
    }

    if (
      !currentCourts ||
      currentCourts.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "The current round does not contain any courts.",
        },
        {
          status: 400,
        },
      );
    }

    const incompleteCourt =
      currentCourts.find(
        (court) =>
          !court.complete ||
          court.team_1_score === null ||
          court.team_2_score === null,
      );

    if (incompleteCourt) {
      return NextResponse.json(
        {
          error: `Court ${incompleteCourt.court_number} does not have a completed score.`,
        },
        {
          status: 400,
        },
      );
    }

    const tiedCourt = currentCourts.find(
      (court) =>
        Number(court.team_1_score) ===
        Number(court.team_2_score),
    );

    if (tiedCourt) {
      return NextResponse.json(
        {
          error: `Court ${tiedCourt.court_number} has a tied score.`,
        },
        {
          status: 400,
        },
      );
    }

    const currentCourtIds =
      currentCourts.map(
        (court) => court.id,
      );

    /*
     * Load current-round assignments.
     */
    const {
      data: courtPlayers,
      error: courtPlayersError,
    } = await supabaseAdmin
      .from("court_players")
      .select(
        `
        court_id,
        event_player_id,
        slot_number,
        team_number
        `,
      )
      .in("court_id", currentCourtIds)
      .order("slot_number", {
        ascending: true,
      });

    if (courtPlayersError) {
      throw courtPlayersError;
    }

    const savedCourtPlayers =
      (courtPlayers ??
        []) as CourtPlayerRecord[];

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

    const databasePlayerIdByEventPlayerId =
      new Map(
        (eventPlayers ?? []).map(
          (eventPlayer) => [
            eventPlayer.id,
            eventPlayer.player_id,
          ],
        ),
      );

    /*
     * Determine each court's winners and losers.
     */
    const outcomes: CourtOutcome[] =
      currentCourts.map((court) => {
        const assignments =
          savedCourtPlayers.filter(
            (courtPlayer) =>
              courtPlayer.court_id === court.id,
          );

        const team1 = assignments.filter(
          (courtPlayer) =>
            courtPlayer.team_number === 1,
        );

        const team2 = assignments.filter(
          (courtPlayer) =>
            courtPlayer.team_number === 2,
        );

        if (
          team1.length !== 2 ||
          team2.length !== 2
        ) {
          throw new Error(
            `Court ${court.court_number} must have two players on each team.`,
          );
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

        const winningAssignments =
          winnerTeam === 1
            ? team1
            : team2;

        const losingAssignments =
          winnerTeam === 1
            ? team2
            : team1;

        const winners =
          winningAssignments.map(
            (assignment) => {
              const databasePlayerId =
                databasePlayerIdByEventPlayerId.get(
                  assignment.event_player_id,
                );

              if (!databasePlayerId) {
                throw new Error(
                  "A database player ID could not be found.",
                );
              }

              return {
                eventPlayerId:
                  assignment.event_player_id,
                databasePlayerId,
              };
            },
          );

        const losers =
          losingAssignments.map(
            (assignment) => {
              const databasePlayerId =
                databasePlayerIdByEventPlayerId.get(
                  assignment.event_player_id,
                );

              if (!databasePlayerId) {
                throw new Error(
                  "A database player ID could not be found.",
                );
              }

              return {
                eventPlayerId:
                  assignment.event_player_id,
                databasePlayerId,
              };
            },
          );

        if (
          winners.length !== 2 ||
          losers.length !== 2
        ) {
          throw new Error(
            `Court ${court.court_number} has an invalid result.`,
          );
        }

        return {
          courtNumber:
            court.court_number,
          winners: [
            winners[0],
            winners[1],
          ],
          losers: [
            losers[0],
            losers[1],
          ],
        };
      });

    /*
     * Apply the existing ladder movement rules.
     */
    const nextCourtAssignments =
      currentCourts.map((court, index) => {
        let players: [
          PlayerOutcome,
          PlayerOutcome,
          PlayerOutcome,
          PlayerOutcome,
        ];

        if (currentCourts.length === 1) {
          players = [
            ...outcomes[index].winners,
            ...outcomes[index].losers,
          ];
        } else if (index === 0) {
          players = [
            ...outcomes[0].winners,
            ...outcomes[1].winners,
          ];
        } else if (
          index ===
          currentCourts.length - 1
        ) {
          players = [
            ...outcomes[index - 1].losers,
            ...outcomes[index].losers,
          ];
        } else {
          players = [
            ...outcomes[index - 1].losers,
            ...outcomes[index + 1].winners,
          ];
        }

        return {
          courtNumber:
            court.court_number,
          players,
        };
      });

    const allNextPlayerIds =
      nextCourtAssignments.flatMap(
        (court) =>
          court.players.map(
            (player) =>
              player.databasePlayerId,
          ),
      );

    if (
      new Set(allNextPlayerIds).size !==
      allNextPlayerIds.length
    ) {
      throw new Error(
        "A player was assigned to more than one court in the next round.",
      );
    }

    /*
     * Create the next round.
     */
    const {
      data: savedNextRound,
      error: saveRoundError,
    } = await supabaseAdmin
      .from("rounds")
      .insert({
        event_id: eventId,
        round_number: nextRoundNumber,
        status: "pairing",
      })
      .select(
        "id, event_id, round_number, status",
      )
      .single();

    if (
      saveRoundError ||
      !savedNextRound
    ) {
      throw (
        saveRoundError ??
        new Error(
          "Unable to create the next round.",
        )
      );
    }

    createdRoundId =
      savedNextRound.id;

    /*
     * Create next-round courts.
     */
    const nextCourtRows =
      nextCourtAssignments.map(
        (court) => ({
          round_id:
            savedNextRound.id,
          court_number:
            court.courtNumber,
          pairing_index: null,
          team_1_score: null,
          team_2_score: null,
          winner_team: null,
          complete: false,
          completed_at: null,
        }),
      );

    const {
      data: savedNextCourts,
      error: saveCourtsError,
    } = await supabaseAdmin
      .from("courts")
      .insert(nextCourtRows)
      .select("id, court_number");

    if (
      saveCourtsError ||
      !savedNextCourts
    ) {
      throw (
        saveCourtsError ??
        new Error(
          "Unable to create the next-round courts.",
        )
      );
    }

    const nextCourtIdByNumber =
      new Map(
        savedNextCourts.map(
          (court) => [
            court.court_number,
            court.id,
          ],
        ),
      );

    /*
     * Create next-round player assignments.
     * Pairings begin as null and will be chosen
     * through Walking Mode.
     */
    const nextCourtPlayerRows =
      nextCourtAssignments.flatMap(
        (court) => {
          const databaseCourtId =
            nextCourtIdByNumber.get(
              court.courtNumber,
            );

          if (!databaseCourtId) {
            throw new Error(
              `Court ${court.courtNumber} was not created.`,
            );
          }

          return court.players.map(
            (player, index) => ({
              court_id:
                databaseCourtId,
              event_player_id:
                player.eventPlayerId,
              slot_number: index + 1,
              team_number: null,
            }),
          );
        },
      );

    const {
      error: saveCourtPlayersError,
    } = await supabaseAdmin
      .from("court_players")
      .insert(nextCourtPlayerRows);

    if (saveCourtPlayersError) {
      throw saveCourtPlayersError;
    }

    /*
     * Mark the prior round complete.
     */
    const {
      error: previousRoundUpdateError,
    } = await supabaseAdmin
      .from("rounds")
      .update({
        status: "complete",
      })
      .eq("id", currentRound.id);

    if (previousRoundUpdateError) {
      throw previousRoundUpdateError;
    }

    /*
     * Point the event at the newly created round.
     */
    const {
      error: eventUpdateError,
    } = await supabaseAdmin
      .from("league_events")
      .update({
        status: "active",
        current_round: nextRoundNumber,
      })
      .eq("id", eventId);

    if (eventUpdateError) {
      throw eventUpdateError;
    }

    return NextResponse.json(
      {
        round: savedNextRound,
        courtCount:
          savedNextCourts.length,
        playerCount:
          nextCourtPlayerRows.length,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Unable to generate next round:",
      error,
    );

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
            : "Unable to generate the next round.",
      },
      {
        status: 500,
      },
    );
  }
}