
import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isResetEligible(deadline: string | null): boolean {
  if (!deadline) return false;

  const parts = deadline.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return false;
  }

  const [year, month, day] = parts;

  // Match PostgreSQL's calendar-month threshold.
  const targetMonth = month - 1 + 3;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0)
  ).getUTCDate();

  const threshold = new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      Math.min(day, lastDay)
    )
  );

  return Date.now() >= threshold.getTime();
}

export async function POST(request: NextRequest) {
  try {
    const staffUser = await requireStaffUser();

    let body: { player_id?: unknown };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    const playerId = body?.player_id;

    if (
      typeof playerId !== "string" ||
      !UUID.test(playerId)
    ) {
      return errorResponse("Invalid player ID.", 400);
    }

    const { data: player, error: playerError } =
      await supabaseAdmin
        .from("club_rating_players")
        .select(
          "id, full_name, rating_status, period_deadline, club_rating"
        )
        .eq("id", playerId)
        .maybeSingle();

    if (playerError) throw playerError;

    if (!player) {
      return errorResponse("Player not found.", 404);
    }

    if (player.rating_status !== "qualified") {
      return errorResponse(
        "Only qualified players can be reset.",
        409
      );
    }

    if (!isResetEligible(player.period_deadline)) {
      return errorResponse(
        "The player has not reached the requalification threshold.",
        409
      );
    }

    // Require confirmed removal from PodPlay.
    const { data: tasks, error: tasksError } =
      await supabaseAdmin
        .from("club_rating_podplay_updates")
        .select("action_type, status, completed_at")
        .eq("club_rating_player_id", playerId)
        .in("action_type", [
          "rating_removal",
          "rating_restoration",
        ])
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

    if (tasksError) throw tasksError;

    const latestAction = tasks?.[0]?.action_type;

    if (latestAction !== "rating_removal") {
      return errorResponse(
        "Confirm the player's PodPlay rating removal before resetting qualification.",
        409
      );
    }

    // Execute the secured database function.
    // The database rechecks status and eligibility.
    const { error: resetError } = await supabaseAdmin.rpc(
      "start_club_rating_requalification",
      {
        p_player_id: playerId,
        p_staff_user_id: staffUser.id,
      }
    );

    if (resetError) {
      console.error("Requalification reset failed:", resetError);

      return errorResponse(
        "Unable to start requalification. The player may no longer be eligible.",
        409
      );
    }

    return NextResponse.json({
      success: true,
      player_id: playerId,
      player_name: player.full_name,
      rating_status: "requalification_required",
      games_needed: 12,
      message:
        "Requalification started. The player must complete two new qualifying sessions of six PB Vision games each.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "AUTH_REQUIRED") {
      return errorResponse("Please sign in.", 401);
    }

    if (message === "STAFF_ACCESS_DENIED") {
      return errorResponse(
        "Staff access is required.",
        403
      );
    }

    console.error("Requalification API error:", error);

    return errorResponse(
      "Unable to process requalification.",
      500
    );
  }
}
