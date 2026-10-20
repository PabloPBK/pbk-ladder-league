import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RatingMethod =
  | "dupr_doubles"
  | "dupr_singles"
  | "club_rating";

type Player = {
  id: string;
  full_name: string;
  club_rating: number | null;
  dupr_doubles: number | null;
  dupr_singles: number | null;
};

function getDatabase() {
  const url = process.env.TV_SUPABASE_URL;
  const key = process.env.TV_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("TV_DATABASE_NOT_CONFIGURED");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "AUTH_REQUIRED") {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (message === "STAFF_ACCESS_DENIED") {
    return NextResponse.json(
      { error: "Staff access required" },
      { status: 403 }
    );
  }

  console.error("Roster teams API error:", error);

  return NextResponse.json(
    { error: "Unable to process roster teams" },
    { status: 500 }
  );
}

function validId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function playerRating(
  player: Player,
  method: RatingMethod
): number | null {
  const value = player[method];

  return value == null ? null : Number(value);
}

async function getEvent(
  db: ReturnType<typeof getDatabase>,
  eventId: string
) {
  const { data, error } = await db
    .from("roster_events")
    .select("id, event_type, rating_method")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

// GET: Teams, rankings, and free agents
export async function GET(request: Request) {
  try {
    await requireStaffUser();

    const eventId = new URL(request.url).searchParams.get(
      "event_id"
    );

    if (!validId(eventId)) {
      return NextResponse.json(
        { error: "Valid event_id is required" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const event = await getEvent(db, eventId);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const { data: players, error: playerError } = await db
      .from("roster_players")
      .select(
        "id, full_name, club_rating, dupr_doubles, dupr_singles"
      )
      .eq("event_id", eventId);

    if (playerError) throw playerError;

    const { data: teams, error: teamError } = await db
      .from("roster_teams")
      .select("id, player1_id, player2_id, created_at")
      .eq("event_id", eventId);

    if (teamError) throw teamError;

    const allPlayers = (players ?? []) as Player[];
    const playerMap = new Map(
      allPlayers.map((player) => [player.id, player])
    );

    const method = event.rating_method as RatingMethod;

    const rankedTeams = (teams ?? [])
      .map((team) => {
        const player1 = playerMap.get(team.player1_id);
        const player2 = playerMap.get(team.player2_id);

        if (!player1 || !player2) {
          return null;
        }

        const rating1 = playerRating(player1, method);
        const rating2 = playerRating(player2, method);

        const combinedRating =
          rating1 == null || rating2 == null
            ? null
            : Math.round((rating1 + rating2) * 1000) /
              1000;

        return {
          id: team.id,
          player1,
          player2,
          combined_rating: combinedRating,
          created_at: team.created_at,
        };
      })
      .filter((team) => team !== null)
      .sort((a, b) => {
        if (a.combined_rating === null) return 1;
        if (b.combined_rating === null) return -1;

        return b.combined_rating - a.combined_rating;
      });

    const assigned = new Set<string>();

    for (const team of teams ?? []) {
      assigned.add(team.player1_id);
      assigned.add(team.player2_id);
    }

    const freeAgents = allPlayers
      .filter((player) => !assigned.has(player.id))
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

    return NextResponse.json(
      {
        event_id: eventId,
        event_type: event.event_type,
        rating_method: method,
        teams: rankedTeams,
        free_agents: freeAgents,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a partnership
export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      !validId(body.event_id) ||
      !validId(body.player1_id) ||
      !validId(body.player2_id) ||
      body.player1_id === body.player2_id
    ) {
      return NextResponse.json(
        { error: "Valid event and two different players required" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const event = await getEvent(db, body.event_id);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (event.event_type !== "partnered") {
      return NextResponse.json(
        {
          error:
            "Partnerships are only available for partnered events",
        },
        { status: 400 }
      );
    }

    const { data: players, error: playerError } = await db
      .from("roster_players")
      .select("id")
      .eq("event_id", body.event_id)
      .in("id", [body.player1_id, body.player2_id]);

    if (playerError) throw playerError;

    if ((players ?? []).length !== 2) {
      return NextResponse.json(
        { error: "Both players must belong to this event" },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await db
      .from("roster_teams")
      .select("player1_id, player2_id")
      .eq("event_id", body.event_id);

    if (existingError) throw existingError;

    const alreadyAssigned = (existing ?? []).some(
      (team) =>
        [
          body.player1_id,
          body.player2_id,
        ].includes(team.player1_id) ||
        [
          body.player1_id,
          body.player2_id,
        ].includes(team.player2_id)
    );

    if (alreadyAssigned) {
      return NextResponse.json(
        { error: "One or both players already have a partner" },
        { status: 409 }
      );
    }

    const { data, error } = await db
      .from("roster_teams")
      .insert({
        event_id: body.event_id,
        player1_id: body.player1_id,
        player2_id: body.player2_id,
      })
      .select("id, player1_id, player2_id")
      .single();

    if (error) {
      if (error.code === "23505" || error.code === "23514") {
        return NextResponse.json(
          { error: "One or both players already have a partner" },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json(
      { team: data },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Remove a partnership, keeping both players
export async function DELETE(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      !validId(body.event_id) ||
      !validId(body.team_id)
    ) {
      return NextResponse.json(
        { error: "Valid event and team IDs required" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    const { data, error } = await db
      .from("roster_teams")
      .delete()
      .eq("id", body.team_id)
      .eq("event_id", body.event_id)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Partnership removed. Both players are now free agents.",
    });
  } catch (error) {
    return handleError(error);
  }
}
