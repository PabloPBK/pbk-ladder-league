
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

// GET: Load player profile and statistics
export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id: playerId } = await context.params;

    if (!playerId) {
      return NextResponse.json(
        { error: "A player ID is required." },
        { status: 400 },
      );
    }

    const {
      data: player,
      error: playerError,
    } = await supabaseAdmin
      .from("players")
      .select("id, name, dupr, dupr_id")
      .eq("id", playerId)
      .maybeSingle();

    if (playerError) {
      throw playerError;
    }

    if (!player) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 },
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
      (eventPlayerData ?? []) as EventPlayerRecord[];

    const eventPlayerIds = eventPlayers.map(
      (eventPlayer) => eventPlayer.id,
    );

    let courtPlayers: CourtPlayerRecord[] = [];

    if (eventPlayerIds.length > 0) {
      const {
        data: courtPlayerData,
        error: courtPlayersError,
      } = await supabaseAdmin
        .from("court_players")
        .select(
          "court_id, event_player_id, team_number",
        )
        .in("event_player_id", eventPlayerIds);

      if (courtPlayersError) {
        throw courtPlayersError;
      }

      courtPlayers =
        (courtPlayerData ?? []) as CourtPlayerRecord[];
    }

    const courtIds = [
      ...new Set(
        courtPlayers.map(
          (courtPlayer) => courtPlayer.court_id,
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
          "id, team_1_score, team_2_score, winner_team, complete",
        )
        .in("id", courtIds);

      if (courtsError) {
        throw courtsError;
      }

      courts = (courtData ?? []) as CourtRecord[];
    }

    const courtById = new Map(
      courts.map((court) => [court.id, court]),
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

      const court = courtById.get(assignment.court_id);

      if (
        !court ||
        !court.complete ||
        court.team_1_score === null ||
        court.team_2_score === null
      ) {
        return;
      }

      const team1Score = Number(court.team_1_score);
      const team2Score = Number(court.team_2_score);

      const winnerTeam =
        court.winner_team ??
        (team1Score > team2Score ? 1 : 2);

      const isTeam1 = assignment.team_number === 1;

      const playerPointsFor = isTeam1
        ? team1Score
        : team2Score;

      const playerPointsAgainst = isTeam1
        ? team2Score
        : team1Score;

      const won =
        assignment.team_number === winnerTeam;

      wins += won ? 1 : 0;
      losses += won ? 0 : 1;
      pointsFor += playerPointsFor;
      pointsAgainst += playerPointsAgainst;
    });

    const gamesPlayed = wins + losses;

    const leagueNights = new Set(
      eventPlayers.map(
        (eventPlayer) => eventPlayer.event_id,
      ),
    ).size;

    return NextResponse.json(
      {
        player: {
          id: player.id,
          name: player.name,
          dupr: Number(player.dupr),
          duprId: player.dupr_id ?? null,
          leagueNights,
          gamesPlayed,
          wins,
          losses,
          winPercentage:
            gamesPlayed > 0
              ? Number(
                  ((wins / gamesPlayed) * 100).toFixed(1),
                )
              : 0,
          pointsFor,
          pointsAgainst,
          pointDifferential:
            pointsFor - pointsAgainst,
        },
      },
      { status: 200 },
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
      { status: 500 },
    );
  }
}

// PATCH: Update player name, DUPR rating, and DUPR ID
export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { requireStaffUser } = await import(
      "@/lib/server/require-auth"
    );

    await requireStaffUser();

    const { id: playerId } = await context.params;

    if (!playerId) {
      return NextResponse.json(
        { error: "Player ID is required." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      dupr?: number;
      duprId?: string | null;
    };

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid player information." },
        { status: 400 },
      );
    }

    const updates: {
      name?: string;
      dupr?: number;
      dupr_id?: string | null;
    } = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
        return NextResponse.json(
          { error: "Player name cannot be empty." },
          { status: 400 },
        );
      }

      updates.name = body.name.trim();
    }

    if (body.dupr !== undefined) {
      if (
        typeof body.dupr !== "number" ||
        !Number.isFinite(body.dupr) ||
        body.dupr < 0 ||
        body.dupr > 8
      ) {
        return NextResponse.json(
          {
            error:
              "Enter a valid DUPR rating between 0 and 8.",
          },
          { status: 400 },
        );
      }

      updates.dupr = body.dupr;
    }

    if (body.duprId !== undefined) {
      if (
        body.duprId !== null &&
        typeof body.duprId !== "string"
      ) {
        return NextResponse.json(
          { error: "Invalid DUPR ID." },
          { status: 400 },
        );
      }

      updates.dupr_id = body.duprId?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No changes were provided." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("players")
      .update(updates)
      .eq("id", playerId)
      .select("id, name, dupr, dupr_id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        player: {
          id: data.id,
          name: data.name,
          dupr: Number(data.dupr),
          duprId: data.dupr_id ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        { error: "Staff sign-in required." },
        { status: 401 },
      );
    }

    console.error("Unable to update player:", error);

    return NextResponse.json(
      { error: "Unable to update player." },
      { status: 500 },
    );
  }
}
