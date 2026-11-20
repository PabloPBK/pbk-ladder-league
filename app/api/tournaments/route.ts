
import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    // Verify the signed-in user is authorized staff.
    await requireStaffUser();

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const facilityId =
      typeof body.facility_id === "string"
        ? body.facility_id
        : "";

    const startDate = body.start_date;
    const endDate = body.end_date;

    if (!name || !facilityId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!uuidPattern.test(facilityId)) {
      return NextResponse.json(
        { error: "Invalid facility." },
        { status: 400 }
      );
    }

    if (
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      !datePattern.test(startDate) ||
      !datePattern.test(endDate) ||
      !Number.isFinite(Date.parse(startDate)) ||
      !Number.isFinite(Date.parse(endDate)) ||
      endDate < startDate
    ) {
      return NextResponse.json(
        { error: "Please provide valid tournament dates." },
        { status: 400 }
      );
    }

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const registrationPlatform =
      typeof body.registration_platform === "string"
        ? body.registration_platform.trim()
        : "";

    const registrationUrl =
      typeof body.registration_url === "string"
        ? body.registration_url.trim()
        : "";

    if (registrationUrl) {
      try {
        const url = new URL(registrationUrl);

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "Enter a valid registration URL." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("tournaments")
      .insert({
        name,
        facility_id: facilityId,
        start_date: startDate,
        end_date: endDate,
        description,
        registration_platform: registrationPlatform,
        registration_url: registrationUrl,
        status: "draft",
        publish_zz2: false,
        publish_pbk_northwest: false,
      })
      .select("id, name, status")
      .single();

    if (error) {
      console.error("Tournament creation failed:", error);

      return NextResponse.json(
        { error: "Unable to save tournament." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        tournament: data,
      },
      { status: 201 }
    );
  } catch (error) {
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

    console.error("Tournament API error:", error);

    return NextResponse.json(
      { error: "Unable to process tournament request." },
      { status: 500 }
    );
  }
}
