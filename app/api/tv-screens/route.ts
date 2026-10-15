import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Authenticate against the existing League Manager.
    await requireStaffUser();

    // Connect separately to the TV Manager database.
    const tvSupabaseUrl =
      process.env.TV_SUPABASE_URL;

    const tvSupabaseSecretKey =
      process.env.TV_SUPABASE_SECRET_KEY;

    if (!tvSupabaseUrl || !tvSupabaseSecretKey) {
      console.error(
        "TV Manager Supabase configuration is missing."
      );

      return NextResponse.json(
        { error: "TV Manager database is not configured" },
        { status: 500 }
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

    const { data, error } = await tvSupabase
      .from("tv_screens")
      .select(
        "id, name, location, display_mode, slide_duration, assigned_content, is_active"
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("TV screens fetch failed:", error);

      return NextResponse.json(
        { error: "Unable to load TV screens" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      screens: data ?? [],
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

    console.error("TV screens API error:", error);

    return NextResponse.json(
      { error: "Unable to load TV screens" },
      { status: 500 }
    );
  }
}
