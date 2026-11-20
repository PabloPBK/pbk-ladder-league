
import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    await requireStaffUser();

    const { data, error } = await supabaseAdmin
      .from("tournament_facilities")
      .select("id, name, address, city, state, website_url, court_count")
      .order("name");

    if (error) {
      console.error("Unable to load tournament facilities:", error);
      return NextResponse.json(
        { error: "Unable to load facilities." },
        { status: 500 }
      );
    }

    return NextResponse.json({ facilities: data ?? [] });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffUser();

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const address =
      typeof body.address === "string" ? body.address.trim() : "";
    const city =
      typeof body.city === "string" ? body.city.trim() : "";
    const state =
      typeof body.state === "string"
        ? body.state.trim().toUpperCase()
        : "";
    const websiteUrl =
      typeof body.website_url === "string"
        ? body.website_url.trim()
        : "";

    if (!name || !city || !state) {
      return NextResponse.json(
        { error: "Facility name, city, and state are required." },
        { status: 400 }
      );
    }

    if (name.length > 200 || city.length > 100 ||
        state.length > 50 || address.length > 300) {
      return NextResponse.json(
        { error: "One or more fields are too long." },
        { status: 400 }
      );
    }

    if (websiteUrl) {
      try {
        const url = new URL(websiteUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Invalid URL");
        }
      } catch {
        return NextResponse.json(
          { error: "Please enter a valid website URL." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("tournament_facilities")
      .insert({
        name,
        address: address || null,
        city,
        state,
        website_url: websiteUrl || null,
      })
      .select("id, name, city, state")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A facility with this name already exists." },
          { status: 409 }
        );
      }

      console.error("Unable to create facility:", error);
      return NextResponse.json(
        { error: "Unable to create facility." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, facility: data },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}

function handleAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "AUTH_REQUIRED") {
    return NextResponse.json(
      { error: "Please sign in to continue." },
      { status: 401 }
    );
  }

  if (message === "STAFF_ACCESS_DENIED") {
    return NextResponse.json(
      { error: "Staff access is required." },
      { status: 403 }
    );
  }

  console.error("Tournament facility API error:", error);

  return NextResponse.json(
    { error: "Unable to process facility request." },
    { status: 500 }
  );
}
