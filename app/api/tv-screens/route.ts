
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    await requireStaffUser();

    const { data, error } = await supabaseAdmin
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
