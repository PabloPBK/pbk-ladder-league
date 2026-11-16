
import { randomUUID } from "node:crypto";
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

type SaveVideoRequest = {
  sessionId?: string;
  videoId?: string;
  scores?: VideoScoreInput[];
};

function handleError(error: unknown) {
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

  console.error("PB Vision score API failed:", error);

  return NextResponse.json(
    { error: "Unable to save PB Vision scores." },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  try {
    await requireStaffUser();

    let body: SaveVideoRequest;

    try {
      body = (await request.json()) as SaveVideoRequest;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body.sessionId !== "string" ||
      !UUID_PATTERN.test(body.sessionId)
    ) {
      return NextResponse.json(
        { error: "A valid rating session is required." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.scores) ||
      body.scores.length !== 4
    ) {
      return NextResponse.json(
        {
          error:
            "Each PB Vision video must have exactly four player ratings.",
        },
        { status: 400 }
      );
    }

    const seenPlayers = new Set<string>();

    const scores: {
      playerId: string;
      rating: number;
    }[] = [];

    for (const score of body.scores) {
      if (
        !score ||
        typeof score.playerId !== "string" ||
        !UUID_PATTERN.test(score.playerId)
      ) {
        return NextResponse.json(
          { error: "Each score needs a valid player." },
          { status: 400 }
        );
      }

      const playerId = score.playerId.toLowerCase();

      if (seenPlayers.has(playerId)) {
        return NextResponse.json(
          {
            error:
              "The same player cannot appear twice in one video.",
          },
          { status: 400 }
        );
      }

      seenPlayers.add(playerId);

      if (
        typeof score.rating !== "number" ||
        !Number.isFinite(score.rating) ||
        score.rating < 0 ||
        score.rating > 8
      ) {
        return NextResponse.json(
          {
            error:
              "Every PB Vision rating must be between 0 and 8.",
          },
          { status: 400 }
        );
      }

      scores.push({
        playerId,
        rating: score.rating,
      });
    }

    const videoId =
      typeof body.videoId === "string" &&
      UUID_PATTERN.test(body.videoId)
        ? body.videoId
        : randomUUID();

    const { data, error } = await supabaseAdmin.rpc(
      "save_club_rating_video",
      {
        p_session_id: body.sessionId,
        p_video_id: videoId,
        p_scores: scores,
      }
    );

    if (error) {
      console.error("PB Vision save RPC error:", error);

      return NextResponse.json(
        {
          error:
            "Scores could not be saved. Verify that the session is active, all four players attended, and this video has not already been recorded.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        result: data,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
