import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

type GameRow = {
  video_id: string | null;
  game_number: number | null;
  club_rating_player_id: string;
  rating_after: number | null;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireStaffUser();
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("club_rating_sessions")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("club_rating_games")
      .select("video_id, game_number, club_rating_player_id, rating_after")
      .eq("session_id", id)
      .order("game_number", { ascending: true });
    if (error) throw error;

    const grouped = new Map<string, {
      videoId: string;
      gameNumber: number;
      scores: { playerId: string; rating: number }[];
    }>();

    for (const game of (data ?? []) as GameRow[]) {
      if (!game.video_id || game.game_number === null || game.rating_after === null) {
        continue;
      }
      let video = grouped.get(game.video_id);
      if (!video) {
        video = { videoId: game.video_id, gameNumber: game.game_number, scores: [] };
        grouped.set(game.video_id, video);
      }
      video.scores.push({
        playerId: game.club_rating_player_id,
        rating: Number(game.rating_after),
      });
    }

    return NextResponse.json({
      videos: Array.from(grouped.values()).sort((a, b) => a.gameNumber - b.gameNumber),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    if (message === "STAFF_ACCESS_DENIED") {
      return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
    }
    console.error("Unable to load PB Vision videos:", error);
    return NextResponse.json({ error: "Unable to load recorded videos." }, { status: 500 });
  }
}
