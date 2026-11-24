import { NextResponse } from "next/server";
import { readLeagueListing } from "@/lib/data/league-listings";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    await requireStaffUser();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in as staff to save a league." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") {
      return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to verify staff access." }, { status: 500 });
  }

  let input;
  try {
    input = readLeagueListing(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid listing." }, { status: 400 });
  }
  const { id, version, listing } = input;
  try {
    if (listing.season_id) {
      const { data: season, error } = await supabaseAdmin.from("seasons").select("league_id")
        .eq("id", listing.season_id).maybeSingle();
      if (error) throw error;
      if (!season || (listing.league_id && listing.league_id !== season.league_id)) {
        return NextResponse.json({ error: "Choose a season that belongs to the selected operations league." }, { status: 400 });
      }
      listing.league_id = season.league_id;
    }

    const query = supabaseAdmin.from("league_listings");
    const write = id
      ? query.update({ ...listing, updated_at: new Date().toISOString() }).eq("id", id).eq("updated_at", version)
      : query.insert(listing);
    const { data, error } = await write.select("id, status, facility_id").maybeSingle();
    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({ error: "The selected facility or operations league is no longer available." }, { status: 400 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ error: "This listing changed. Reload it before saving again." }, { status: 409 });
    return NextResponse.json({ listing: data }, { status: id ? 200 : 201 });
  } catch (error) {
    console.error("Unable to save league listing:", error);
    return NextResponse.json({ error: "Unable to save the listing. Try again." }, { status: 500 });
  }
}
