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

  console.error("TV presentations API error:", error);

  return NextResponse.json(
    { error: "Unable to process TV presentations" },
    { status: 500 }
  );
}

// Get all presentations
export async function GET() {
  try {
    await requireStaffUser();

    const db = getTVDatabase();

    const { data, error } = await db
      .from("tv_presentations")
      .select(
        "id, name, description, is_active, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      presentations: data ?? [],
    });
  } catch (error) {
    return handleError(error);
  }
}

// Create a presentation
export async function POST(request: Request) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 120 ||
      (body.description != null &&
        (typeof body.description !== "string" ||
          body.description.length > 2000))
    ) {
      return NextResponse.json(
        { error: "Invalid presentation details" },
        { status: 400 }
      );
    }

    const db = getTVDatabase();

    const { data, error } = await db
      .from("tv_presentations")
      .insert({
        name: body.name.trim(),
        description:
          body.description?.trim() || null,
      })
      .select(
        "id, name, description, is_active, created_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json(
      { presentation: data },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
