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

function errorResponse(error: unknown) {
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

  console.error("TV slide reorder API error:", error);

  return NextResponse.json(
    { error: "Unable to save slide order" },
    { status: 500 }
  );
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

    const presentationId = body?.presentation_id;
    const slideIds = body?.slide_ids;

    if (
      !isUUID(presentationId) ||
      !Array.isArray(slideIds) ||
      slideIds.length === 0 ||
      slideIds.length > 500 ||
      !slideIds.every(isUUID) ||
      new Set(slideIds).size !== slideIds.length
    ) {
      return NextResponse.json(
        { error: "Invalid slide order details" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    // Verify that every submitted slide belongs to
    // this presentation and that no slides are omitted.
    const { data: existingSlides, error: lookupError } =
      await db
        .from("tv_slides")
        .select("id, sort_order")
        .eq("presentation_id", presentationId);

    if (lookupError) throw lookupError;

    const existing = existingSlides ?? [];

    if (
      existing.length !== slideIds.length ||
      !slideIds.every((id) =>
        existing.some((slide) => slide.id === id)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The presentation slides have changed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    // Assign temporary unique positions first.
    // This avoids collisions when the database has
    // a uniqueness constraint on slide positions.
    const highestOrder = Math.max(
      0,
      ...existing.map((slide) => slide.sort_order ?? 0)
    );

    const temporaryStart = highestOrder + slideIds.length + 1;

    for (let index = 0; index < slideIds.length; index++) {
      const { data, error } = await db
        .from("tv_slides")
        .update({
          sort_order: temporaryStart + index,
        })
        .eq("id", slideIds[index])
        .eq("presentation_id", presentationId)
        .select("id");

      if (error) throw error;
      if (!data || data.length !== 1) {
        throw new Error("SLIDE_UPDATE_FAILED");
      }
    }

    // Save the final positions in the requested order.
    for (let index = 0; index < slideIds.length; index++) {
      const { data, error } = await db
        .from("tv_slides")
        .update({
          sort_order: index,
        })
        .eq("id", slideIds[index])
        .eq("presentation_id", presentationId)
        .select("id");

      if (error) throw error;
      if (!data || data.length !== 1) {
        throw new Error("SLIDE_UPDATE_FAILED");
      }
    }

    return NextResponse.json({
      success: true,
      slide_ids: slideIds,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
