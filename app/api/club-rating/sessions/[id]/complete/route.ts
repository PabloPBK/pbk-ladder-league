
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
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
        .select("id, status")
        .eq("id", id)
        .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    if (session.status === "completed") {
      return NextResponse.json(
        { error: "This session is already completed." },
        { status: 409 }
      );
    }

    if (session.status === "cancelled") {
      return NextResponse.json(
        { error: "Cancelled sessions cannot be completed." },
        { status: 409 }
      );
    }

    const { data: games, error: gamesError } =
      await supabaseAdmin
        .from("club_rating_games")
        .select("id, club_rating_player_id, video_id, rating_after")
        .eq("session_id", id);

    if (gamesError) {
      throw gamesError;
    }

    const validGames = (games ?? []).filter(
      (game) =>
        game.video_id !== null &&
        game.rating_after !== null
    );

    if (validGames.length === 0) {
      return NextResponse.json(
        {
          error:
            "Cannot complete a session without PB Vision scores.",
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .update({ status: "completed" })
        .eq("id", id)
        .in("status", ["scheduled", "in_progress"])
        .select("id, status")
        .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Session status changed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      session: updated,
      recorded_scores: validGames.length,
      message:
        "Session completed successfully. Rating publication is not yet enabled.",
    });
  } catch (error) {
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

    console.error(
      "Club Rating session completion error:",
      error
    );

    return NextResponse.json(
      { error: "Unable to complete session." },
      { status: 500 }
    );
  }
}
