
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CompletionResult = {
  success: boolean;
  session_id: string;
  status: string;
  ratings_published: number;
  player_notifications_queued: number;
  staff_notifications_queued: number;
  players_missing_email: number;
};

type Game = {
  club_rating_player_id: string;
  video_id: string | null;
};

function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    // Only authenticated staff may complete sessions.
    await requireStaffUser();

    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      return errorResponse("Invalid session ID.");
    }

    // Check session status before calling the RPC.
    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .select("id, status")
        .eq("id", id)
        .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return errorResponse("Session not found.", 404);
    }

    if (session.status === "completed") {
      return errorResponse(
        "This session is already completed.",
        409
      );
    }

    if (session.status === "cancelled") {
      return errorResponse(
        "Cancelled sessions cannot be completed.",
        409
      );
    }

    // Gather dashboard statistics before completion.
    // The database function independently validates
    // the scores and attendance within its transaction.
    const { data: games, error: gamesError } =
      await supabaseAdmin
        .from("club_rating_games")
        .select("club_rating_player_id, video_id")
        .eq("session_id", id);

    if (gamesError) {
      throw gamesError;
    }

    const records = (games ?? []) as Game[];

    const uniqueVideos = new Set<string>();
    const playerGameCounts = new Map<
      string,
      number
    >();

    for (const game of records) {
      if (game.video_id) {
        uniqueVideos.add(game.video_id);
      }

      const playerId =
        game.club_rating_player_id;

      playerGameCounts.set(
        playerId,
        (playerGameCounts.get(playerId) ?? 0) + 1
      );
    }

    const playersWithSixGames =
      Array.from(
        playerGameCounts.values()
      ).filter(
        (count) => count >= 6
      ).length;

    // Atomic database transaction:
    // - Validate PB Vision games and attendance
    // - Complete session
    // - Publish initial ratings
    // - Queue player and staff notifications
    // - Create PodPlay update tasks
    const { data, error: rpcError } =
      await supabaseAdmin.rpc(
        "complete_club_rating_session",
        {
          p_session_id: id,
        }
      );

    if (rpcError) {
      console.error(
        "Club Rating completion RPC error:",
        rpcError
      );

      const message =
        rpcError.message ?? "";

      if (
        message.includes(
          "Session cannot be completed"
        )
      ) {
        return errorResponse(
          "Session status changed. Refresh and try again.",
          409
        );
      }

      if (
        message.includes("Session not found")
      ) {
        return errorResponse(
          "Session not found.",
          404
        );
      }

      if (
        message.includes(
          "No attended players"
        ) ||
        message.includes(
          "Session has no recorded games"
        ) ||
        message.includes(
          "invalid PB Vision scores"
        ) ||
        message.includes(
          "Every video must contain"
        )
      ) {
        return errorResponse(message);
      }

      return errorResponse(
        "Unable to complete session. No changes were saved.",
        500
      );
    }

    const result = data as CompletionResult | null;

    if (!result?.success) {
      return errorResponse(
        "Session completion did not succeed.",
        500
      );
    }

    // Keep the existing dashboard response fields,
    // and add the new publication/notification results.
    return NextResponse.json({
      success: true,

      session: {
        id: result.session_id,
        status: result.status,
      },

      videos_recorded: uniqueVideos.size,
      scores_recorded: records.length,
      players_scored: playerGameCounts.size,
      players_with_six_games:
        playersWithSixGames,

      ratings_published:
        result.ratings_published,

      player_notifications_queued:
        result.player_notifications_queued,

      staff_notifications_queued:
        result.staff_notifications_queued,

      players_missing_email:
        result.players_missing_email,

      message:
        "Session completed successfully. " +
        `${result.ratings_published} official rating(s) published. ` +
        `${result.player_notifications_queued} player notification(s) queued. ` +
        `${result.staff_notifications_queued} staff notification(s) queued.`,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (message === "AUTH_REQUIRED") {
      return errorResponse(
        "Please sign in.",
        401
      );
    }

    if (message === "STAFF_ACCESS_DENIED") {
      return errorResponse(
        "Staff access is required.",
        403
      );
    }

    console.error(
      "Club Rating session completion error:",
      error
    );

    return errorResponse(
      "Unable to complete session.",
      500
    );
  }
}
