
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

export async function GET() {
  try {
    await requireStaffUser();
    const { data, error } = await supabaseAdmin
      .from("tournaments")
      .select("id, name, status, start_date, end_date, facility_id, tournament_facilities(name, city, state)")
      .order("start_date", { ascending: true });
    if (error) {
      console.error("Tournament listing failed:", error);
      return NextResponse.json({ error: "Unable to load tournaments." }, { status: 500 });
    }
    const { data: sites, error: sitesError } = await supabaseAdmin.from("tournament_websites").select("id,name,is_connected");
    if (sitesError) throw sitesError;
    const { data: mappings, error: mappingsError } = await supabaseAdmin.from("tournament_facility_websites").select("facility_id,website_id");
    if (mappingsError) throw mappingsError;
    const tournaments = (data ?? []).map(t => {
      const destinationIds = new Set(["zz2", ...(mappings ?? []).filter(m => m.facility_id === t.facility_id).map(m => m.website_id)]);
      return {
        ...t,
        destinations: (sites ?? []).filter(site => destinationIds.has(site.id)).map(site => ({
          id: site.id,
          name: site.name,
          is_connected: site.is_connected,
          is_preview_available: site.id === "zz2",
        })),
      };
    });
    return NextResponse.json({ tournaments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED") return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (message === "STAFF_ACCESS_DENIED") return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
    console.error("Tournament listing error:", error);
    return NextResponse.json({ error: "Unable to load tournaments." }, { status: 500 });
  }
}
