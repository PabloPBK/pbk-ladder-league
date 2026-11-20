
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VideoScoreInput = {
  playerId?: string;
  rating?: number;
};

type CorrectVideoRequest = {
  sessionId?: string;
  videoId?: string;
  scores?: VideoScoreInput[];
  reason?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireStaffUser();

    let body: CorrectVideoRequest;

    try {
      body = (await request.json()) as CorrectVideoRequest;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body.sessionId !== "string" ||
      !UUID_PATTERN.test(body.sessionId) ||
      typeof body.videoId !== "string" ||
      !UUID_PATTERN.test(body.videoId)
    ) {
      return NextResponse.json(
        { error: "Valid session and video IDs are required." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.scores) ||
      body.scores.length !== 4
    ) {
      return NextResponse.json(
        { error: "Exactly four player ratings are required." },
        { status: 400 }
      );
    }

    const seenPlayers = new Set<string>();
    const scores: { playerId: string; rating: number }[] = [];

    for (const score of body.scores) {
      if (
        !score ||
        typeof score.playerId !== "string" ||
        !UUID_PATTERN.test(score.playerId) ||
        typeof score.rating !== "number" ||
        !Number.isFinite(score.rating) ||
        score.rating < 0 ||
        score.rating > 8
      ) {
        return NextResponse.json(
          { error: "Each player needs a valid rating between 0 and 8." },
          { status: 400 }
        );
      }

      const playerId = score.playerId.toLowerCase();

      if (seenPlayers.has(playerId)) {
        return NextResponse.json(
          { error: "Players cannot appear twice in one video." },
          { status: 400 }
        );
      }

      seenPlayers.add(playerId);
      scores.push({ playerId, rating: score.rating });
    }

    if (
      typeof body.reason !== "string" ||
      body.reason.trim().length < 10 ||
      body.reason.trim().length > 500
    ) {
      return NextResponse.json(
        { error: "Enter a correction reason of 10 to 500 characters." },
        { status: 400 }
      );
    }

    // Determine whether this is an open or completed session.
    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("club_rating_sessions")
        .select("status")
        .eq("id", body.sessionId)
        .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Rating session not found." },
        { status: 404 }
      );
    }

    let functionName: string;

    if (session.status === "completed") {
      functionName = "correct_club_rating_video_completed";
    } else if (
      session.status === "scheduled" ||
      session.status === "in_progress"
    ) {
      functionName = "correct_club_rating_video_open";
    } else {
      return NextResponse.json(
        { error: "Scores cannot be corrected in this session." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      functionName,
      {
        p_session_id: body.sessionId,
        p_video_id: body.videoId,
        p_scores: scores,
        p_reason: body.reason.trim(),
        p_staff_user_id: user.id,
      }
    );

    if (error) {
      console.error("PB Vision correction error:", error);

      return NextResponse.json(
        {
          error:
            error.message ||
            "Unable to correct PB Vision scores.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
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

    console.error("PB Vision correction API failed:", error);

    return NextResponse.json(
      { error: "Unable to process the score correction." },
      { status: 500 }
    );
  }
}
