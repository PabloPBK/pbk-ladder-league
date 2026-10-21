import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FACILITY_ID = "lynnwood";

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

  console.error("Facility schedule API error:", error);

  return NextResponse.json(
    { error: "Unable to process facility schedule" },
    { status: 500 }
  );
}

// Public read-only access for TV displays.
export async function GET() {
  try {
    const db = getTVDatabase();

    const { data, error } = await db
      .from("facility_schedule")
      .select("facility_id, schedule_data, updated_at")
      .eq("facility_id", FACILITY_ID)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Facility schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

// Staff-only schedule editing.
export async function PUT(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);
    const scheduleData = body?.schedule_data;

    if (
      !scheduleData ||
      typeof scheduleData !== "object" ||
      Array.isArray(scheduleData) ||
      typeof scheduleData.facility !== "string" ||
      typeof scheduleData.welcome !== "string" ||
      !Array.isArray(scheduleData.announcements) ||
      !Array.isArray(scheduleData.events)
    ) {
      return NextResponse.json(
        { error: "Invalid schedule data" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const { data, error } = await db
      .from("facility_schedule")
      .update({
        schedule_data: scheduleData,
        updated_at: new Date().toISOString(),
      })
      .eq("facility_id", FACILITY_ID)
      .select("facility_id, schedule_data, updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Facility schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      schedule: data,
    });
  } catch (error) {
    return handleError(error);
  }
}
