import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

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

  console.error("Roster events API error:", error);

  return NextResponse.json(
    { error: "Unable to process roster events" },
    { status: 500 }
  );
}

// GET: Retrieve all events
export async function GET() {
  try {
    await requireStaffUser();

    const db = getTVDatabase();

    const { data, error } = await db
      .from("roster_events")
      .select(
        "id, name, event_date, event_type, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      { events: data ?? [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a new event
export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 120 ||
      !["partnered", "individual"].includes(
        body.event_type
      )
    ) {
      return NextResponse.json(
        { error: "Invalid event details" },
        { status: 400 }
      );
    }

    let eventDate: string | null = null;

    if (
      body.event_date !== undefined &&
      body.event_date !== null &&
      body.event_date !== ""
    ) {
      if (
        typeof body.event_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
          body.event_date
        )
      ) {
        return NextResponse.json(
          { error: "Invalid event date" },
          { status: 400 }
        );
      }

      const parsedDate = new Date(
        `${body.event_date}T00:00:00Z`
      );

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !==
          body.event_date
      ) {
        return NextResponse.json(
          { error: "Invalid event date" },
          { status: 400 }
        );
      }

      eventDate = body.event_date;
    }

    const db = getTVDatabase();

    const { data, error } = await db
      .from("roster_events")
      .insert({
        name: body.name.trim(),
        event_date: eventDate,
        event_type: body.event_type,
      })
      .select(
        "id, name, event_date, event_type, created_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json(
      { event: data },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
