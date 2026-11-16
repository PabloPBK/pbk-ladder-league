
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "AUTH_REQUIRED") {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  if (message === "STAFF_ACCESS_DENIED") {
    return NextResponse.json(
      { error: "Staff access is required." },
      { status: 403 }
    );
  }

  console.error("Club Rating session roster error:", error);

  return NextResponse.json(
    { error: "Unable to load session players." },
    { status: 500 }
  );
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    await requireStaffUser();

    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .select("id, session_name, session_date, status")
        .eq("id", id)
        .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    const { data: roster, error: rosterError } =
      await supabaseAdmin
        .from("club_rating_session_players")
        .select(
          "club_rating_player_id, attendance_status"
        )
        .eq("session_id", id);

    if (rosterError) {
      throw rosterError;
    }

    const playerIds = (roster ?? []).map(
      (entry) => entry.club_rating_player_id
    );

    if (playerIds.length === 0) {
      return NextResponse.json({
        session,
        players: [],
      });
    }

    const { data: playerRecords, error: playersError } =
      await supabaseAdmin
        .from("club_rating_players")
        .select("id, full_name")
        .in("id", playerIds);

    if (playersError) {
      throw playersError;
    }

    const names = new Map(
      (playerRecords ?? []).map((player) => [
        player.id,
        player.full_name,
      ])
    );

    const players = (roster ?? [])
      .map((entry) => ({
        id: entry.club_rating_player_id,
        full_name:
          names.get(entry.club_rating_player_id) ??
          "Unknown Player",
        attendance_status: entry.attendance_status,
      }))
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

    return NextResponse.json({
      session,
      players,
    });
  } catch (error) {
    return handleError(error);
  }
}
