
import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionType =
  | "rating_removal"
  | "rating_restoration"
  | "rating_update";

type ManualActionType =
  | "rating_removal"
  | "rating_restoration";

type PlayerProgress = {
  player_id: string;
  rating_status: string | null;
  club_rating: number | null;
  games_remaining: number | null;
};

type PlayerRecord = {
  id: string;
  period_deadline: string | null;
};

type PodPlayTask = {
  id: string;
  club_rating_player_id: string;
  action_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

const MANUAL_ACTIONS: ManualActionType[] = [
  "rating_removal",
  "rating_restoration",
];

const ACTIONS: ActionType[] = [
  "rating_removal",
  "rating_restoration",
  "rating_update",
];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function overdue(
  progress: PlayerProgress,
  player: PlayerRecord
): boolean {
  return (
    progress.rating_status?.toLowerCase() === "qualified" &&
    (progress.games_remaining ?? 0) > 0 &&
    !!player.period_deadline &&
    player.period_deadline.slice(0, 10) < todayUTC()
  );
}

async function getPlayerState(playerId: string) {
  const [playerResult, progressResult] = await Promise.all([
    supabaseAdmin
      .from("club_rating_players")
      .select("id, period_deadline")
      .eq("id", playerId)
      .maybeSingle(),

    supabaseAdmin
      .from("club_rating_player_progress")
      .select(
        "player_id, rating_status, club_rating, games_remaining"
      )
      .eq("player_id", playerId)
      .maybeSingle(),
  ]);

  if (playerResult.error) throw playerResult.error;
  if (progressResult.error) throw progressResult.error;

  if (!playerResult.data || !progressResult.data) {
    return null;
  }

  return {
    player: playerResult.data as PlayerRecord,
    progress: progressResult.data as PlayerProgress,
  };
}

async function getActionHistory(playerId: string) {
  const { data, error } = await supabaseAdmin
    .from("club_rating_podplay_updates")
    .select(
      "id, club_rating_player_id, action_type, status, created_at, completed_at"
    )
    .eq("club_rating_player_id", playerId)
    .in("action_type", MANUAL_ACTIONS)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as PodPlayTask[];
}

function latestCompleted(
  tasks: PodPlayTask[],
  action: ManualActionType
) {
  return tasks
    .filter(
      (task) =>
        task.action_type === action &&
        task.status === "completed"
    )
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(
        a.completed_at ?? ""
      )
    )[0];
}

function hasPending(
  tasks: PodPlayTask[],
  action: ManualActionType
) {
  return tasks.some(
    (task) =>
      task.action_type === action &&
      task.status === "pending"
  );
}

function ratingCurrentlyRemoved(tasks: PodPlayTask[]) {
  const removal = latestCompleted(tasks, "rating_removal");
  const restoration = latestCompleted(
    tasks,
    "rating_restoration"
  );

  return (
    !!removal &&
    (!restoration ||
      (removal.completed_at ?? "") >
        (restoration.completed_at ?? ""))
  );
}

function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "AUTH_REQUIRED") {
    return responseError("Please sign in.", 401);
  }

  if (message === "STAFF_ACCESS_DENIED") {
    return responseError("Staff access is required.", 403);
  }

  console.error("PodPlay task API error:", error);

  return responseError(
    "Unable to process PodPlay tasks.",
    500
  );
}

// GET: Return removal, restoration, and rating-update tasks.
export async function GET() {
  try {
    await requireStaffUser();

    const { data, error } = await supabaseAdmin
      .from("club_rating_podplay_updates")
      .select(
        "id, club_rating_player_id, action_type, status, rating, created_at, completed_at, completed_by, staff_notes"
      )
      .in("action_type", ACTIONS)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      tasks: data ?? [],
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Only manual removal/restoration requests.
// Rating-update tasks are created by the rating system.
export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json();
    const playerId = body.player_id;
    const actionType = body.action_type as ManualActionType;

    if (
      typeof playerId !== "string" ||
      !UUID.test(playerId) ||
      !MANUAL_ACTIONS.includes(actionType)
    ) {
      return responseError(
        "Invalid player or action.",
        400
      );
    }

    const state = await getPlayerState(playerId);

    if (!state) {
      return responseError("Player not found.", 404);
    }

    const tasks = await getActionHistory(playerId);

    if (hasPending(tasks, actionType)) {
      return responseError(
        "This action is already pending.",
        409
      );
    }

    const removed = ratingCurrentlyRemoved(tasks);

    if (actionType === "rating_removal") {
      if (!overdue(state.progress, state.player)) {
        return responseError(
          "Player is not currently overdue.",
          409
        );
      }

      if (removed) {
        return responseError(
          "The PodPlay rating is already marked as removed.",
          409
        );
      }
    }

    if (actionType === "rating_restoration") {
      if (!removed) {
        return responseError(
          "A confirmed PodPlay removal is required first.",
          409
        );
      }

      if (
        state.progress.rating_status?.toLowerCase() !==
          "qualified" ||
        state.progress.club_rating == null ||
        overdue(state.progress, state.player)
      ) {
        return responseError(
          "The player must complete renewal before restoration.",
          409
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("club_rating_podplay_updates")
      .insert({
        club_rating_player_id: playerId,
        action_type: actionType,
        status: "pending",
        rating:
          actionType === "rating_restoration"
            ? state.progress.club_rating
            : null,
        session_id: null,
        staff_notes:
          actionType === "rating_removal"
            ? "Manual removal from PodPlay requested."
            : "Manual restoration to PodPlay requested.",
      })
      .select("id, action_type, status")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { task: data },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

// PATCH: Confirm that staff completed the task in PodPlay.
export async function PATCH(request: NextRequest) {
  try {
    const staffUser = await requireStaffUser();

    const body = await request.json();
    const taskId = body.task_id;

    if (
      typeof taskId !== "string" ||
      !UUID.test(taskId)
    ) {
      return responseError("Invalid task ID.", 400);
    }

    const { data: task, error: taskError } =
      await supabaseAdmin
        .from("club_rating_podplay_updates")
        .select(
          "id, club_rating_player_id, action_type, status, rating"
        )
        .eq("id", taskId)
        .maybeSingle();

    if (taskError) throw taskError;

    if (
      !task ||
      task.status !== "pending" ||
      !ACTIONS.includes(task.action_type as ActionType)
    ) {
      return responseError(
        "Pending task not found.",
        404
      );
    }

    // Rating updates already contain the rating calculated
    // by the Club Rating system. Do not recalculate it here.
    if (task.action_type === "rating_update") {
      if (
        task.rating == null ||
        !Number.isFinite(Number(task.rating))
      ) {
        return responseError(
          "This rating update has no valid rating.",
          409
        );
      }

      const { data, error } = await supabaseAdmin
        .from("club_rating_podplay_updates")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: staffUser.id,
        })
        .eq("id", taskId)
        .eq("status", "pending")
        .eq("action_type", "rating_update")
        .eq("rating", task.rating)
        .select(
          "id, action_type, status, rating, completed_at, completed_by"
        )
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return responseError(
          "Task was changed or already completed. Refresh and review.",
          409
        );
      }

      return NextResponse.json({ task: data });
    }

    // Existing removal/restoration workflow.
    const state = await getPlayerState(
      task.club_rating_player_id
    );

    if (!state) {
      return responseError("Player not found.", 404);
    }

    const history = await getActionHistory(
      task.club_rating_player_id
    );

    if (task.action_type === "rating_removal") {
      if (!overdue(state.progress, state.player)) {
        return responseError(
          "Player is no longer overdue. Review this task.",
          409
        );
      }

      if (ratingCurrentlyRemoved(history)) {
        return responseError(
          "Rating is already marked as removed.",
          409
        );
      }
    }

    if (task.action_type === "rating_restoration") {
      if (
        !ratingCurrentlyRemoved(history) ||
        overdue(state.progress, state.player) ||
        state.progress.rating_status?.toLowerCase() !==
          "qualified" ||
        state.progress.club_rating == null
      ) {
        return responseError(
          "Player is not eligible for restoration.",
          409
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("club_rating_podplay_updates")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: staffUser.id,
        rating:
          task.action_type === "rating_restoration"
            ? state.progress.club_rating
            : null,
      })
      .eq("id", taskId)
      .eq("status", "pending")
      .select(
        "id, action_type, status, completed_at, completed_by"
      )
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return responseError(
        "Task was already completed.",
        409
      );
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    return handleError(error);
  }
}
