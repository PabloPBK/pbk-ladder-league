import { NextResponse } from "next/server";
import { isUuid } from "@/lib/data/league-listings";
import { parseNoShowAmount } from "@/lib/data/open-play-no-show-billing";
import { noShowFacilityId } from "@/lib/data/open-play-no-shows";
import { requireStaffUser, staffApiDenial } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

function invalid(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireStaffUser();
  } catch (error) {
    return staffApiDenial(error);
  }

  const { id } = await params;
  if (!isUuid(id)) return invalid("Invalid queue entry.");

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const staffName = typeof body?.staffName === "string" ? body.staffName.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const amount = typeof body?.amount === "string" ? parseNoShowAmount(body.amount) : null;
  const table = supabaseAdmin.from("open_play_no_shows");
  const now = new Date().toISOString();
  let update;

  if (["claim", "refund", "note", "exception", "charged"].includes(action) && (!staffName || staffName.length > 100)) {
    return invalid("Enter your staff name before saving.");
  }
  if ((action === "refund" || action === "exception") && (!reason || reason.length > 500)) {
    return invalid("Enter a reason for the reversal.");
  }
  if ((action === "charged" || action === "refund") && amount === null) {
    return invalid("Enter the actual amount in dollars and cents greater than zero, up to $10,000.");
  }

  const reversal = {
    status: "reversed", reversed_at: now, reversed_by: user.id,
    reversal_staff_name: staffName, reversal_reason: reason,
  };
  if (action === "claim") {
    update = table.update({ claimed_by: user.id, claimed_at: now, staff_name: staffName })
      .is("claimed_by", null).eq("status", "pending");
  } else if (action === "release" || action === "charged" || action === "exception") {
    const version = body.claimedAt;
    if (!validTimestamp(version)) {
      return invalid("Reload the queue and start the review before recording an outcome.");
    }
    const fields = action === "release"
      ? { claimed_by: null, claimed_at: null, staff_name: null }
      : action === "charged"
        ? { status: "charged", resolved_at: now, charge_cents: amount, staff_name: staffName }
        : { ...reversal, resolved_at: now, reversal_cents: 0 };
    update = table.update(fields).eq("status", "pending").eq("claimed_by", user.id).eq("claimed_at", version);
  } else if (action === "refund") {
    update = table.update({ ...reversal, reversal_cents: amount }).eq("status", "charged");
  } else if (action === "note") {
    const version = body.notesUpdatedAt;
    if (version !== null && !validTimestamp(version)) return invalid("Reload the queue before editing notes.");
    if (typeof body.notes !== "string" || body.notes.length > 2000) return invalid("Notes must be 2,000 characters or fewer.");
    const updatedAt = version === null ? now : new Date(Math.max(Date.now(), Date.parse(version) + 1)).toISOString();
    const note = table.update({
      notes: body.notes.trim() || null, notes_updated_at: updatedAt, notes_updated_by: user.id, notes_staff_name: staffName,
    }).in("status", ["charged", "reversed", "skipped"]);
    update = version === null ? note.is("notes_updated_at", null) : note.eq("notes_updated_at", version);
  } else {
    return invalid("Choose a valid review action.");
  }

  const { data, error } = await update.eq("id", id).eq("facility_id", noShowFacilityId).select("id").maybeSingle();
  if (error) {
    if (action === "refund" && error.code === "23514" && error.message.includes("open_play_no_shows_lifecycle_check")) {
      return invalid("The refund cannot exceed the original charge.");
    }
    console.error("Unable to update the open-play queue:", error.code);
    return NextResponse.json({ error: "Unable to save the review. Try again." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Someone else changed this entry. Check the refreshed queue before trying again." }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
