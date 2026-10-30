
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PB101EmailDay } from "./pb101-email-templates";

const SENDER_EMAIL =
  "pablo@pickleballkingdomlynnwood.com";

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

// Convert 10:00 AM in Lynnwood to a UTC timestamp.
// Handles Pacific Standard and Daylight Saving Time.
function pacificTenAM(date: string): string {
  const utcNoon = new Date(`${date}T12:00:00Z`);

  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  })
    .formatToParts(utcNoon)
    .find((part) => part.type === "timeZoneName")
    ?.value;

  const match = timeZoneName?.match(
    /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/
  );

  if (!match) {
    throw new Error("Unable to determine Pacific time offset.");
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);

  const offsetMinutes = sign * (hours * 60 + minutes);

  const utcTenAM =
    Date.parse(`${date}T10:00:00Z`) -
    offsetMinutes * 60_000;

  return new Date(utcTenAM).toISOString();
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

  // Only schedule emails when consent is recorded.
  if (
    guest.email_opted_out ||
    !guest.email_consent_at ||
    !guest.trial_start_date ||
    !guest.email
  ) {
    return 0;
  }

  // Stop scheduling when the guest has made a final decision.
  if (
    guest.status === "converted" ||
    guest.status === "declined" ||
    guest.status === "paused" ||
    guest.membership_decision === "converted" ||
    guest.membership_decision === "declined"
  ) {
    return 0;
  }

  const rows = EMAIL_SCHEDULE.map(({ day, type }) => {
    const scheduledDate = addDays(
      guest.trial_start_date,
      day
    );

    return {
      guest_id: guest.id,
      email_type: type,
      recipient_email: guest.email,
      sender_name: SENDER_NAME,
      sender_email: SENDER_EMAIL,
      scheduled_at: pacificTenAM(scheduledDate),
      status: "pending",
    };
  });

  // Keep existing email records unchanged.
  // The database prevents duplicate guest/email-type pairs.
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
