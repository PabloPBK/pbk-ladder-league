import { NextResponse } from "next/server";
import { isUuid } from "@/lib/data/league-listings";
import { noShowFacilityId } from "@/lib/data/open-play-no-shows";
import { requireStaffUser, staffApiDenial } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireStaffUser();
  } catch (error) {
    return staffApiDenial(error);
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid queue entry." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const table = supabaseAdmin.from("open_play_no_shows");
  const now = new Date().toISOString();
  let update;

  if (action === "claim") {
    const staffName = typeof body.staffName === "string" ? body.staffName.trim() : "";
    if (!staffName || staffName.length > 100) {
      return NextResponse.json({ error: "Enter your staff name before starting a review." }, { status: 400 });
    }
    update = table.update({ claimed_by: user.id, claimed_at: now, staff_name: staffName }).is("claimed_by", null);
  } else if (action === "release" || action === "charged" || action === "skipped") {
    const version = body.claimedAt;
    if (typeof version !== "string" || !Number.isFinite(Date.parse(version))) {
      return NextResponse.json({ error: "Reload the queue and start the review before recording an outcome." }, { status: 400 });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (action === "skipped" && (!reason || reason.length > 500)) {
      return NextResponse.json({ error: "Enter why the charge was skipped." }, { status: 400 });
    }
    const fields = action === "release"
      ? { claimed_by: null, claimed_at: null, staff_name: null }
      : { status: action, resolved_at: now, skip_reason: action === "skipped" ? reason : null };
    update = table.update(fields).eq("claimed_by", user.id).eq("claimed_at", version);
  } else {
    return NextResponse.json({ error: "Choose a valid review action." }, { status: 400 });
  }

  const { data, error } = await update.eq("id", id).eq("facility_id", noShowFacilityId)
    .eq("status", "pending").select("id").maybeSingle();
  if (error) {
    console.error("Unable to update the open-play queue:", error.code);
    return NextResponse.json({ error: "Unable to save the review. Try again." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Someone else changed this entry. The queue has been refreshed." }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
