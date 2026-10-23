import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Only authorized League Manager staff can edit TVs.
    await requireStaffUser();

    const { id } = await context.params;

    // Validate the TV screen UUID.
    // Correct UUID format: 8-4-4-4-12
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid TV screen ID" },
        { status: 400 }
      );
    }

    const tvSupabaseUrl = process.env.TV_SUPABASE_URL;
    const tvSupabaseSecretKey =
      process.env.TV_SUPABASE_SECRET_KEY;

    if (!tvSupabaseUrl || !tvSupabaseSecretKey) {
      console.error(
        "TV Manager database configuration missing"
      );

      return NextResponse.json(
        { error: "TV Manager database is not configured" },
        { status: 500 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request" },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid TV settings" },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const {
      name,
      location,
      display_mode,
      slide_duration,
      is_active,
    } = input;

    // Validate settings before updating Supabase.
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      (location !== null &&
        (typeof location !== "string" ||
          location.length > 150)) ||
    !["single", "slideshow", "daily_schedule"].includes(
  String(display_mode)
) ||
      typeof slide_duration !== "number" ||
      !Number.isInteger(slide_duration) ||
      slide_duration < 1 ||
      slide_duration > 3600 ||
      typeof is_active !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Please enter valid TV settings" },
        { status: 400 }
      );
    }

    const tvSupabase = createClient(
      tvSupabaseUrl,
      tvSupabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Update settings without changing the display token.
    const { data, error } = await tvSupabase
      .from("tv_screens")
      .update({
        name: name.trim(),
        location,
        display_mode,
        slide_duration,
        is_active,
      })
      .eq("id", id)
      .select(
        "id, name, location, display_mode, slide_duration, is_active"
      )
      .maybeSingle();

    if (error) {
      console.error(
        "TV screen update failed:",
        error
      );

      return NextResponse.json(
        { error: "Unable to save TV settings" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "TV screen not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      screen: data,
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

    console.error(
      "TV settings API error:",
      error
    );

    return NextResponse.json(
      { error: "Unable to save TV settings" },
      { status: 500 }
    );
  }
}
