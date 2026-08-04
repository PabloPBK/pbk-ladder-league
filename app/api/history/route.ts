import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type EventRecord = {
  id: string;
  season_id: string;
  event_date: string;
  name: string;
  status: string;
  current_round: number;
};

type RoundRecord = {
  id: string;
  event_id: string;
  round_number: number;
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
};

type StandingAccumulator = {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
};

export async function GET() {
  try {
    const {
      data: eventData,
      error: eventsError,
    } = await supabaseAdmin
      .from("league_events")
      .select(
        "id, season_id, event_date, name, status, current_round",
      )
      .eq("status", "complete")
      .order("event_date", {
        ascending: false,
      });

    if (eventsError) {
      throw eventsError;
    }

    const events =
      (eventData ?? []) as EventRecord[];

    if (events.length === 0) {
      return NextResponse.json({
        events: [],
      });
    }

    const eventIds = events.map(
      (event) => event.id,
    );

    const {
      data: roundData,
      error: roundsError,
    } = await supabaseAdmin
      .from("rounds")
      .select("id, event_id, round_number")
      .in("event_id", eventIds);

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
          "id, round_id, team_1_score, team_2_score, winner_team, complete",
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
      .in("event_id", eventIds);

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
        .select("id, name")
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
          "court_id, event_player_id, team_number",
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

    const summaries = events.map((event) => {
      const eventRounds = rounds.filter(
        (round) =>
          round.event_id === event.id,
      );

      const eventRoundIds = new Set(
        eventRounds.map((round) => round.id),
      );

      const eventCourts = courts.filter(
        (court) =>
          eventRoundIds.has(court.round_id),
      );

      const completedEventCourts =
        eventCourts.filter(
          (court) => court.complete,
        );

      const eventRoster =
        eventPlayers.filter(
          (eventPlayer) =>
            eventPlayer.event_id === event.id,
        );

      const standingsByPlayerId =
        new Map<
          string,
          StandingAccumulator
        >();

      eventRoster.forEach((eventPlayer) => {
        const player = playerById.get(
          eventPlayer.player_id,
        );

        if (!player) {
          return;
        }

        standingsByPlayerId.set(player.id, {
          playerId: player.id,
          name: player.name,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointDifferential: 0,
        });
      });

      completedEventCourts.forEach(
        (court) => {
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
            courtPlayers.filter(
              (courtPlayer) =>
                courtPlayer.court_id ===
                court.id,
            );

          assignments.forEach(
            (assignment) => {
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

              if (
                !eventPlayer ||
                eventPlayer.event_id !==
                  event.id
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

              standing.wins += won ? 1 : 0;
              standing.losses += won ? 0 : 1;
              standing.pointsFor += pointsFor;
              standing.pointsAgainst +=
                pointsAgainst;
              standing.pointDifferential +=
                pointsFor - pointsAgainst;
            },
          );
        },
      );

      const standings = [
        ...standingsByPlayerId.values(),
      ].sort((playerA, playerB) => {
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
      });

      const winner = standings[0];

      return {
        id: event.id,
        seasonId: event.season_id,
        eventDate: event.event_date,
        name: event.name,
        status: event.status,
        roundCount: eventRounds.length,
        playerCount: eventRoster.length,
        matchCount:
          completedEventCourts.length,
        winner: winner
          ? {
              playerId: winner.playerId,
              name: winner.name,
              wins: winner.wins,
              losses: winner.losses,
              pointDifferential:
                winner.pointDifferential,
            }
          : null,
      };
    });

    return NextResponse.json({
      events: summaries,
    });
  } catch (error) {
    console.error(
      "Unable to load league history:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load league history.",
      },
      {
        status: 500,
      },
    );
  }
}