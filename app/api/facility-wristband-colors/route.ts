
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffUser } from "@/lib/server/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FACILITY_ID = "lynnwood";

type ColorInput = {
  name?: unknown;
  hex_color?: unknown;
  is_active?: unknown;
};

function getDatabase() {
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

function errorResponse(error: unknown) {
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

  console.error("Wristband color API error:", error);

  return NextResponse.json(
    { error: "Unable to process wristband colors" },
    { status: 500 }
  );
}

function validHex(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
  );
}

export async function GET() {
  try {
    const db = getDatabase();

    const { data, error } = await db
      .from("facility_wristband_colors")
      .select("id, name, hex_color, is_active")
      .eq("facility_id", FACILITY_ID)
      .order("name");

    if (error) throw error;

    return NextResponse.json(
      { colors: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const body: ColorInput | null =
      await request.json().catch(() => null);

    const name =
      typeof body?.name === "string"
        ? body.name.trim()
        : "";

    if (
      !name ||
      name.length > 50 ||
      !validHex(body?.hex_color)
    ) {
      return NextResponse.json(
        { error: "Enter a valid name and hex color" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    const { data, error } = await db
      .from("facility_wristband_colors")
      .insert({
        facility_id: FACILITY_ID,
        name,
        hex_color: body.hex_color.toUpperCase(),
        is_active: true,
      })
      .select("id, name, hex_color, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This color already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(
      { color: data },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json().catch(() => null);
    const id = body?.id;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid color ID" },
        { status: 400 }
      );
    }

    const updates: {
      name?: string;
      hex_color?: string;
      is_active?: boolean;
    } = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 50
      ) {
        return NextResponse.json(
          { error: "Invalid color name" },
          { status: 400 }
        );
      }

      updates.name = body.name.trim();
    }

    if (body.hex_color !== undefined) {
      if (!validHex(body.hex_color)) {
        return NextResponse.json(
          { error: "Invalid hex color" },
          { status: 400 }
        );
      }

      updates.hex_color =
        body.hex_color.toUpperCase();
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") {
        return NextResponse.json(
          { error: "Invalid active status" },
          { status: 400 }
        );
      }

      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    const { data, error } = await db
      .from("facility_wristband_colors")
      .update(updates)
      .eq("facility_id", FACILITY_ID)
      .eq("id", id)
      .select("id, name, hex_color, is_active")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This color name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Color not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ color: data });
  } catch (error) {
    return errorResponse(error);
  }
}
