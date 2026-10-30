
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPB101Email } from "./pb101-gmail";
import {
  getPB101EmailTemplate,
  type PB101EmailDay,
} from "./pb101-email-templates";

const EMAIL_DAYS: Record<string, PB101EmailDay> = {
  welcome: 0,
  day_2: 2,
  day_4: 4,
  day_6: 6,
  day_9: 9,
};

const MAX_PER_RUN = 10;

// Safety switch. No automatic emails will be sent
// until this is explicitly enabled.
const SENDING_ENABLED =
  process.env.PB101_AUTOMATION_ENABLED === "true";

type WorkerResult = {
  enabled: boolean;
  checked: number;
  sent: number;
  cancelled: number;
  failed: number;
  skipped: number;
};

export async function processPB101EmailQueue():
  Promise<WorkerResult> {
  const result: WorkerResult = {
    enabled: SENDING_ENABLED,
    checked: 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    skipped: 0,
  };

  if (!SENDING_ENABLED) {
    return result;
  }

  const now = new Date();

  const { data: pending, error } = await supabaseAdmin
    .from("pb101_email_log")
    .select(
      "id, guest_id, email_type, recipient_email, scheduled_at"
    )
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    throw new Error(
      `Unable to load PB101 email queue: ${error.message}`
    );
  }

  for (const item of pending ?? []) {
    result.checked++;

    // Atomically claim this message.
    const { data: claimed, error: claimError } =
      await supabaseAdmin.rpc("claim_pb101_email", {
        p_email_id: item.id,
      });

    if (claimError) {
      console.error(
        "PB101 email claim failed:",
        claimError
      );
      result.failed++;
      continue;
    }

    if (!claimed?.length) {
      result.skipped++;
      continue;
    }

    const cancel = async (reason: string) => {
      const { error: updateError } = await supabaseAdmin
        .from("pb101_email_log")
        .update({
          status: "cancelled",
          error_message: reason,
        })
        .eq("id", item.id)
        .eq("status", "processing");

      if (updateError) {
        throw updateError;
      }

      result.cancelled++;
    };

    try {
      const { data: guest, error: guestError } =
        await supabaseAdmin
          .from("pb101_guests")
          .select(
            "first_name, email, trial_end_date, status, email_opted_out, email_consent_at, membership_decision"
          )
          .eq("id", item.guest_id)
          .maybeSingle();

      if (guestError || !guest) {
        await cancel("Guest record unavailable.");
        continue;
      }

      if (
        !guest.email_consent_at ||
        guest.email_opted_out
      ) {
        await cancel("Guest has no email consent.");
        continue;
      }

      if (
        ["converted", "declined", "paused"].includes(
          guest.status
        ) ||
        ["converted", "declined"].includes(
          guest.membership_decision ?? ""
        )
      ) {
        await cancel(
          "Guest is no longer eligible for follow-up."
        );
        continue;
      }

      if (
        guest.email.toLowerCase() !==
        item.recipient_email.toLowerCase()
      ) {
        await cancel(
          "Guest email changed after scheduling."
        );
        continue;
      }

      const day = EMAIL_DAYS[item.email_type];

      if (day === undefined) {
        await cancel("Unknown email template.");
        continue;
      }

      // Do not send messages scheduled before today.
      // This prevents accidental historical backfills.
      const scheduledDate = new Date(
        item.scheduled_at
      ).toLocaleDateString("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const today = now.toLocaleDateString("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      if (scheduledDate < today) {
        await cancel(
          "Scheduled date has passed; historical email skipped."
        );
        continue;
      }

      const template = getPB101EmailTemplate(day, {
        firstName: guest.first_name,
        trialEndDate: guest.trial_end_date,
      });

      // Gmail returns a provider message ID.
      const messageId = await sendPB101Email({
        to: guest.email,
        subject: template.subject,
        text: template.text,
      });

      const { error: sentError } = await supabaseAdmin
        .from("pb101_email_log")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: messageId,
          error_message: null,
        })
        .eq("id", item.id)
        .eq("status", "processing");

      if (sentError) {
        throw sentError;
      }

      result.sent++;
    } catch (sendError) {
      console.error(
        "PB101 email processing failed:",
        item.id,
        sendError
      );

      // Do not automatically retry uncertain deliveries.
      // A Gmail request may have succeeded even if the
      // application encountered a later error.
      const { error: failureError } =
        await supabaseAdmin
          .from("pb101_email_log")
          .update({
            status: "failed",
            error_message:
              sendError instanceof Error
                ? sendError.message.slice(0, 1000)
                : "Unknown processing error.",
          })
          .eq("id", item.id)
          .eq("status", "processing");

      if (failureError) {
        console.error(
          "Unable to record PB101 email failure:",
          failureError
        );
      }

      result.failed++;
    }
  }

  return result;
}
