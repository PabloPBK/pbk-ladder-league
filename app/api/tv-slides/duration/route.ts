
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTVDatabase() {
  const url = process.env.TV_SUPABASE_URL;
  const key = process.env.TV_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("TV_DATABASE_NOT_CONFIGURED");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function PATCH(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    const slideId = body?.slide_id;
    const duration = body?.duration_seconds;

    if (
      !isUUID(slideId) ||
      typeof duration !== "number" ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 60
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid slide details. Duration must be between 5 and 60 seconds.",
        },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const { data: slide, error: lookupError } = await db
      .from("tv_slides")
      .select("id, media_type")
      .eq("id", slideId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!slide) {
      return NextResponse.json(
        { error: "Slide not found" },
        { status: 404 }
      );
    }

    // Images and live roster slides support
    // individual display durations.
    // Videos continue playing until finished.
    const allowedTypes = [
      "image",
      "roster_teams",
      "roster_free_agents",
    ];

    if (!allowedTypes.includes(slide.media_type)) {
      return NextResponse.json(
        {
          error:
            "Duration settings are available for images and live roster slides only.",
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await db
      .from("tv_slides")
      .update({ duration_seconds: duration })
      .eq("id", slideId)
      .select("id, duration_seconds")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      slide: updated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (message === "STAFF_ACCESS_DENIED") {
      return NextResponse.json(
        { error: "Staff access required" },
        { status: 403 }
      );
    }

    console.error("TV slide duration API error:", error);

    return NextResponse.json(
      { error: "Unable to save slide duration" },
      { status: 500 }
    );
  }
}
