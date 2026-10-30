
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PB101EmailDay } from "./pb101-email-templates";

const SENDER_EMAIL = "pablo@pickleballkingdomlynnwood.com";
const SENDER_NAME = "The Pickleball Kingdom Team";

const EMAIL_SCHEDULE = [
  { day: 0, type: "welcome" },
  { day: 2, type: "day_2" },
  { day: 4, type: "day_4" },
  { day: 6, type: "day_6" },
  { day: 9, type: "day_9" },
] as const satisfies ReadonlyArray<{
  day: PB101EmailDay;
  type: string;
}>;

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export async function schedulePB101Emails(
  guestId: string
): Promise<number> {
  const { data: guest, error } = await supabaseAdmin
    .from("pb101_guests")
    .select(
      "id, email, trial_start_date, status, email_opted_out, email_consent_at, membership_decision"
    )
    .eq("id", guestId)
    .single();

  if (error || !guest) {
    throw new Error("PB101 guest not found.");
  }

  // Never schedule emails without recorded consent.
  if (
    guest.email_opted_out ||
    !guest.email_consent_at ||
    !guest.trial_start_date ||
    !guest.email
  ) {
    return 0;
  }

  if (
    guest.status === "converted" ||
    guest.status === "declined" ||
    guest.status === "paused" ||
    guest.membership_decision === "converted" ||
    guest.membership_decision === "declined"
  ) {
    return 0;
  }

  const rows = EMAIL_SCHEDULE.map(({ day, type }) => ({
    guest_id: guest.id,
    email_type: type,
    recipient_email: guest.email,
    sender_name: SENDER_NAME,
    sender_email: SENDER_EMAIL,
    scheduled_at: `${addDays(
      guest.trial_start_date,
      day
    )}T10:00:00-07:00`,
    status: "pending",
  }));

  // Ignore emails that have already been scheduled.
  // The database has a unique constraint on
  // (guest_id, email_type).
  const { data, error: insertError } = await supabaseAdmin
    .from("pb101_email_log")
    .upsert(rows, {
      onConflict: "guest_id,email_type",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) {
    throw new Error(
      `Unable to schedule PB101 emails: ${insertError.message}`
    );
  }

  return data?.length ?? 0;
}
