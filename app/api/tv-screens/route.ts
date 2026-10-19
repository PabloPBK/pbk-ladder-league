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

function handleError(error: unknown) {
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

  console.error("TV screens API error:", error);

  return NextResponse.json(
    { error: "Unable to process TV screens" },
    { status: 500 }
  );
}

// GET: Retrieve all TVs and available presentations.
export async function GET() {
  try {
    await requireStaffUser();

    const db = getTVDatabase();

    const [screensResult, presentationsResult] =
      await Promise.all([
        db
          .from("tv_screens")
          .select(
            "id, name, location, display_mode, slide_duration, assigned_content, is_active, presentation_id"
          )
          .order("created_at", { ascending: true }),

        db
          .from("tv_presentations")
          .select("id, name, is_active")
          .order("name", { ascending: true }),
      ]);

    if (screensResult.error) {
      throw screensResult.error;
    }

    if (presentationsResult.error) {
      throw presentationsResult.error;
    }

    return NextResponse.json({
      screens: screensResult.data ?? [],
      presentations: presentationsResult.data ?? [],
    });
  } catch (error) {
    return handleError(error);
  }
}

// PATCH: Assign a presentation to an existing TV.
export async function PATCH(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    const screenId = body?.screen_id;
    const presentationId = body?.presentation_id;

    if (
      !isUUID(screenId) ||
      !(presentationId === null || isUUID(presentationId))
    ) {
      return NextResponse.json(
        { error: "Invalid TV assignment details" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    // Verify the presentation exists before assigning it.
    if (presentationId !== null) {
      const { data: presentation, error: lookupError } =
        await db
          .from("tv_presentations")
          .select("id")
          .eq("id", presentationId)
          .maybeSingle();

      if (lookupError) throw lookupError;

      if (!presentation) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 }
        );
      }
    }

    // Update only the presentation assignment.
    // Existing TV settings remain unchanged.
    const { data: screen, error: updateError } = await db
      .from("tv_screens")
      .update({
        presentation_id: presentationId,
      })
      .eq("id", screenId)
      .select("id, name, presentation_id")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!screen) {
      return NextResponse.json(
        { error: "TV screen not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      screen,
    });
  } catch (error) {
    return handleError(error);
  }
}
