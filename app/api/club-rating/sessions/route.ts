
import { NextResponse } from "next/server";

import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type CreateSessionRequest = {
  sessionName?: string;
  sessionDate?: string;
};

export async function GET() {
  try {
    await requireStaffUser();

    const { data, error } = await supabaseAdmin
      .from("club_rating_sessions")
      .select(
        "id, session_date, session_name, status, created_at"
      )
      .order("session_date", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      sessions: data ?? [],
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body =
      (await request.json()) as CreateSessionRequest;

    const sessionName = body.sessionName?.trim();
    const sessionDate = body.sessionDate;

    if (
      !sessionDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ||
      Number.isNaN(Date.parse(`${sessionDate}T00:00:00Z`)) ||
      new Date(`${sessionDate}T00:00:00Z`)
        .toISOString()
        .slice(0, 10) !== sessionDate
    ) {
      return NextResponse.json(
        { error: "A valid session date is required." },
        { status: 400 }
      );
    }

    if (!sessionName || sessionName.length > 150) {
      return NextResponse.json(
        {
          error:
            "Enter a session name between 1 and 150 characters.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("club_rating_sessions")
      .insert({
        session_name: sessionName,
        session_date: sessionDate,
        status: "scheduled",
      })
      .select(
        "id, session_date, session_name, status, created_at"
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { session: data },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "AUTH_REQUIRED") {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  if (message === "STAFF_ACCESS_DENIED") {
    return NextResponse.json(
      { error: "Staff access is required." },
      { status: 403 }
    );
  }

  console.error("Club Rating sessions API error:", error);

  return NextResponse.json(
    { error: "Unable to process rating sessions." },
    { status: 500 }
  );
}
