
import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["rating_removal", "rating_restoration"] as const;

type ActionType = (typeof ACTIONS)[number];

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

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

  return NextResponse.json(
    { error: "Unable to process PodPlay tasks." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    await requireStaffUser();

    const { data, error } = await supabaseAdmin
      .from("club_rating_podplay_updates")
      .select(
        "id, club_rating_player_id, action_type, status, rating, created_at, completed_at, staff_notes"
      )
      .in("action_type", [...ACTIONS])
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tasks: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json();

    const playerId = body.player_id;
    const actionType = body.action_type as ActionType;

    if (
      typeof playerId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        playerId
      ) ||
      !ACTIONS.includes(actionType)
    ) {
      return NextResponse.json(
        { error: "Invalid player or action." },
        { status: 400 }
      );
    }

    const { data: player, error: playerError } = await supabaseAdmin
      .from("club_rating_players")
      .select("id")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("club_rating_podplay_updates")
      .select("id")
      .eq("club_rating_player_id", playerId)
      .eq("action_type", actionType)
      .eq("status", "pending")
      .limit(1);

    if (existingError) throw existingError;

    if (existing?.length) {
      return NextResponse.json(
        { error: "This action is already pending." },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("club_rating_podplay_updates")
      .insert({
        club_rating_player_id: playerId,
        action_type: actionType,
        status: "pending",
        staff_notes: "Manual PodPlay action requested.",
      })
      .select("id, action_type, status")
      .single();

    if (error) throw error;

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json();
    const taskId = body.task_id;

    if (
      typeof taskId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        taskId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid task ID." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("club_rating_podplay_updates")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("status", "pending")
      .in("action_type", [...ACTIONS])
      .select("id, action_type, status, completed_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Pending task not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    return errorResponse(error);
  }
}
