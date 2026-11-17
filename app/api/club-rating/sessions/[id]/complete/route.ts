
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Game = {
  id: string;
  club_rating_player_id: string;
  video_id: string | null;
  rating_after: number | null;
  game_data: Record<string, unknown> | null;
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
    await requireStaffUser();

    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      return errorResponse("Invalid session ID.");
    }

    // 1. Load session
    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .select("id, status")
        .eq("id", id)
        .single();

    if (sessionError || !session) {
      return errorResponse(
        "Session not found.",
        404
      );
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

    // 2. Load session roster
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

    const attendedPlayers = new Set(
      (roster ?? [])
        .filter(
          (player) =>
            player.attendance_status === "attended"
        )
        .map(
          (player) =>
            player.club_rating_player_id
        )
    );

    // 3. Load all recorded games
    const { data: games, error: gamesError } =
      await supabaseAdmin
        .from("club_rating_games")
        .select(
          "id, club_rating_player_id, video_id, rating_after, game_data"
        )
        .eq("session_id", id);

    if (gamesError) {
      throw gamesError;
    }

    const records = (games ?? []) as Game[];

    if (records.length === 0) {
      return errorResponse(
        "Cannot complete a session without PB Vision scores."
      );
    }

    // 4. Validate every score
    for (const game of records) {
      if (!game.video_id) {
        return errorResponse(
          "A game is missing its video ID."
        );
      }

      if (
        game.game_data?.source !== "pb_vision"
      ) {
        return errorResponse(
          "A game has an invalid PB Vision source."
        );
      }

      if (
        game.rating_after === null ||
        !Number.isFinite(
          Number(game.rating_after)
        ) ||
        Number(game.rating_after) < 0 ||
        Number(game.rating_after) > 8
      ) {
        return errorResponse(
          "A game contains an invalid PB Vision rating."
        );
      }

      if (
        !attendedPlayers.has(
          game.club_rating_player_id
        )
      ) {
        return errorResponse(
          "A scored player is not marked as attended in this session."
        );
      }
    }

    // 5. Group scores by video
    const videos = new Map<string, Game[]>();

    for (const game of records) {
      const videoId = game.video_id!;

      const group = videos.get(videoId) ?? [];

      group.push(game);

      videos.set(videoId, group);
    }

    // 6. Every video must have exactly
    // four different players
    for (const [videoId, scores] of videos) {
      if (scores.length !== 4) {
        return errorResponse(
          `Video ${videoId} has ${scores.length} scores. Exactly 4 are required.`
        );
      }

      const uniquePlayers = new Set(
        scores.map(
          (score) =>
            score.club_rating_player_id
        )
      );

      if (uniquePlayers.size !== 4) {
        return errorResponse(
          `Video ${videoId} contains duplicate players.`
        );
      }
    }

    // 7. Count games per player
    const playerGameCounts = new Map<
      string,
      number
    >();

    for (const game of records) {
      const playerId =
        game.club_rating_player_id;

      playerGameCounts.set(
        playerId,
        (playerGameCounts.get(playerId) ?? 0) + 1
      );
    }

    const qualifiedPlayers = Array.from(
      playerGameCounts.values()
    ).filter(
      (count) => count >= 6
    ).length;

    // 8. Complete session
    // Official ratings are NOT updated here.
    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .update({
          status: "completed",
        })
        .eq("id", id)
        .in("status", [
          "scheduled",
          "in_progress",
        ])
        .select("id, status")
        .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updated) {
      return errorResponse(
        "Session status changed. Refresh and try again.",
        409
      );
    }

    return NextResponse.json({
      success: true,
      session: updated,
      videos_recorded: videos.size,
      scores_recorded: records.length,
      players_scored: playerGameCounts.size,
      players_with_six_games: qualifiedPlayers,
      message:
        "Session completed successfully. Official Club Rating publication is not yet enabled.",
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
