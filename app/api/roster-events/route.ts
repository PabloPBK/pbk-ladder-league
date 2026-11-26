
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { getTVDatabase } from "@/lib/server/tv-database";

export const dynamic = "force-dynamic";

type RatingMethod =
  | "dupr_doubles"
  | "dupr_singles"
  | "club_rating";

const ratingMethods: RatingMethod[] = [
  "dupr_doubles",
  "dupr_singles",
  "club_rating",
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const eventFields =
  "id, name, event_date, event_type, rating_method, logo_storage_path, created_at";

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

function isRatingMethod(
  value: unknown
): value is RatingMethod {
  return (
    typeof value === "string" &&
    ratingMethods.includes(value as RatingMethod)
  );
}

function validateEventDate(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error("INVALID_EVENT_DATE");
  }

  const parsedDate = new Date(
    `${value}T00:00:00Z`
  );

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("INVALID_EVENT_DATE");
  }

  return value;
}

// GET: Retrieve all events
export async function GET() {
  try {
    await requireStaffUser();

    const db = getTVDatabase();

    const { data, error } = await db
      .from("roster_events")
      .select(eventFields)
      .order("created_at", {
        ascending: false,
      });

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
      typeof body !== "object" ||
      Array.isArray(body) ||
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

    const ratingMethod =
      body.rating_method ?? "dupr_doubles";

    if (!isRatingMethod(ratingMethod)) {
      return NextResponse.json(
        { error: "Invalid rating method" },
        { status: 400 }
      );
    }

    let eventDate: string | null;

    try {
      eventDate = validateEventDate(body.event_date);
    } catch {
      return NextResponse.json(
        { error: "Invalid event date" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const { data, error } = await db
      .from("roster_events")
      .insert({
        name: body.name.trim(),
        event_date: eventDate,
        event_type: body.event_type,
        rating_method: ratingMethod,
      })
      .select(eventFields)
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

// PATCH: Update an existing event's rating method
export async function PATCH(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.id !== "string" ||
      !uuidPattern.test(body.id) ||
      !(body.name === undefined || (typeof body.name === "string" && !!body.name.trim() && body.name.trim().length <= 120)) ||
      !(body.event_date === undefined || body.event_date === null || typeof body.event_date === "string") ||
      !(body.event_type === undefined || ["partnered", "individual"].includes(body.event_type)) ||
      !(body.rating_method === undefined || isRatingMethod(body.rating_method))
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid event update details",
        },
        { status: 400 }
      );
    }

    let eventDate: string | null | undefined;
    try {
      eventDate = body.event_date === undefined ? undefined : validateEventDate(body.event_date);
    } catch {
      return NextResponse.json({ error: "Invalid event date" }, { status: 400 });
    }
    const updates: Record<string, string | null> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (eventDate !== undefined) updates.event_date = eventDate;
    if (body.event_type !== undefined) updates.event_type = body.event_type;
    if (body.rating_method !== undefined) updates.rating_method = body.rating_method;
    if (!Object.keys(updates).length) return NextResponse.json({error:"No changes provided"},{status:400});
    const db = getTVDatabase();

    const { data, error } = await db
      .from("roster_events")
      .update(updates)
      .eq("id", body.id)
      .select(eventFields)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { event: data },
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
