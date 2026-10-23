import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FACILITY_ID = "lynnwood";
const FACILITY_TIMEZONE = "America/Los_Angeles";

type ScheduleData = {
  facility: string;
  welcome: string;
  announcements: string[];
  events: unknown[];
  schedule_date?: string;
  [key: string]: unknown;
};

type ScheduleRow = {
  facility_id: string;
  schedule_data: ScheduleData;
  updated_at: string;
};

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

function facilityDate() {
  // en-CA generally formats YYYY-MM-DD; formatToParts guarantees ordering.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FACILITY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

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

// Advance the daily schedule on the first request after midnight.
// An optimistic updated_at condition avoids overwriting a concurrent staff save.
async function getCurrentSchedule(db: ReturnType<typeof getTVDatabase>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await db
      .from("facility_schedule")
      .select("facility_id, schedule_data, updated_at")
      .eq("facility_id", FACILITY_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as ScheduleRow;
    const today = facilityDate();
    const savedDate = row.schedule_data?.schedule_date;

    // For existing undated schedules, adopt today's date without deleting events.
    // This prevents the first deployment from unexpectedly erasing today's work.
    const nextSchedule: ScheduleData = {
      ...row.schedule_data,
      schedule_date: today,
      events: savedDate && savedDate !== today ? [] : row.schedule_data.events,
    };

    if (savedDate === today) return row;

    const { data: updated, error: updateError } = await db
      .from("facility_schedule")
      .update({
        schedule_data: nextSchedule,
        updated_at: new Date().toISOString(),
      })
      .eq("facility_id", FACILITY_ID)
      .eq("updated_at", row.updated_at)
      .select("facility_id, schedule_data, updated_at")
      .maybeSingle();

    if (updateError) throw updateError;
    if (updated) return updated as ScheduleRow;
  }

  throw new Error("SCHEDULE_UPDATE_CONFLICT");
}

// Public read-only access for TV displays.
export async function GET() {
  try {
    const db = getTVDatabase();
    const data = await getCurrentSchedule(db);

    if (!data) {
      return NextResponse.json(
        { error: "Facility schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
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
    const current = await getCurrentSchedule(db);

    if (!current) {
      return NextResponse.json(
        { error: "Facility schedule not found" },
        { status: 404 }
      );
    }

    const today = facilityDate();
    const submittedDate = (scheduleData as ScheduleData).schedule_date;

    // If a staff member left the editor open overnight, do not republish
    // yesterday's events when they press Save & Publish.
    if (submittedDate && submittedDate !== today) {
      return NextResponse.json(
        {
          error:
            "The schedule has moved to a new day. Refresh the page before publishing today's events.",
        },
        { status: 409 }
      );
    }

    const nextSchedule: ScheduleData = {
      ...(scheduleData as ScheduleData),
      schedule_date: today,
    };

    const { data, error } = await db
      .from("facility_schedule")
      .update({
        schedule_data: nextSchedule,
        updated_at: new Date().toISOString(),
      })
      .eq("facility_id", FACILITY_ID)
      .eq("updated_at", current.updated_at)
      .select("facility_id, schedule_data, updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        {
          error:
            "The schedule changed while you were editing. Refresh and try again.",
        },
        { status: 409 }
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
