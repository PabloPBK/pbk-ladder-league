
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireStaffUser();

    const { data, error } = await supabaseAdmin
      .from("club_rating_player_progress")
      .select(
        "player_id, full_name, club_rating, rating_status, games_needed, games_completed, games_remaining"
      )
      .order("full_name", { ascending: true });

    if (error) {
      console.error(
        "Club Rating player progress query failed:",
        error
      );

      return NextResponse.json(
        { error: "Unable to load player ratings." },
        { status: 500 }
      );
    }

    const { data: deadlines, error: deadlineError } =
      await supabaseAdmin
        .from("club_rating_players")
        .select("id, period_deadline");

    if (deadlineError) {
      console.error(
        "Club Rating renewal deadline query failed:",
        deadlineError
      );

      return NextResponse.json(
        { error: "Unable to load renewal deadlines." },
        { status: 500 }
      );
    }

    const deadlineMap = new Map(
      (deadlines ?? []).map((player) => [
        player.id,
        player.period_deadline,
      ])
    );

    const players = (data ?? []).map((player) => ({
      ...player,
      period_deadline:
        deadlineMap.get(player.player_id) ?? null,
    }));

    return NextResponse.json({ players });
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
      "Club Rating players API failed:",
      error
    );

    return NextResponse.json(
      { error: "Unable to load player ratings." },
      { status: 500 }
    );
  }
}
