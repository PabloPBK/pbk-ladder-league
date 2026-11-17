
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    await requireStaffUser();

    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .select("id, session_date, session_name, status")
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
          `
          id,
          club_rating_player_id,
          attendance_status,
          rating_session_override,
          rating_override_reason,
          rating_override_by,
          rating_override_at,
          club_rating_players (
            id,
            full_name,
            email,
            club_rating,
            period_deadline
          )
          `
        )
        .eq("session_id", id);

    if (rosterError) {
      throw rosterError;
    }

    const players = [];

    for (const entry of roster ?? []) {
      const { data: classification, error } =
        await supabaseAdmin.rpc(
          "classify_club_rating_session",
          {
            p_player_id: entry.club_rating_player_id,
            p_session_id: id,
          }
        );

      players.push({
        ...entry,
        classification: error
          ? null
          : classification,
        classification_error: error
          ? error.message
          : null,
      });
    }

    return NextResponse.json({
      session,
      players,
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

    console.error("Club Rating roster API:", error);

    return NextResponse.json(
      { error: "Unable to load session players." },
      { status: 500 }
    );
  }
}
