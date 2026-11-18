
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPB101Email } from "./pb101-gmail";

const MAX_PER_RUN = 10;

// Safety switch: no Club Rating emails will be sent
// until this is explicitly enabled.
const SENDING_ENABLED =
  process.env.CLUB_RATING_AUTOMATION_ENABLED === "true";

type WorkerResult = {
  enabled: boolean;
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
};

type Notification = {
  id: string;
  recipient_email: string;
  subject: string;
  message_body: string;
};

export async function processClubRatingEmailQueue():
  Promise<WorkerResult> {
  const result: WorkerResult = {
    enabled: SENDING_ENABLED,
    checked: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  if (!SENDING_ENABLED) {
    return result;
  }

  const { data: pending, error } = await supabaseAdmin
    .from("club_rating_notifications")
    .select(
      "id, recipient_email, subject, message_body"
    )
    .eq("delivery_status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    throw new Error(
      `Unable to load Club Rating email queue: ${error.message}`
    );
  }

  for (const item of (pending ?? []) as Notification[]) {
    result.checked++;

    // Atomically claim this notification.
    const { data: claimed, error: claimError } =
      await supabaseAdmin.rpc(
        "claim_club_rating_notification",
        {
          p_notification_id: item.id,
        }
      );

    if (claimError) {
      console.error(
        "Club Rating notification claim failed:",
        claimError
      );
      result.failed++;
      continue;
    }

    if (!claimed?.length) {
      result.skipped++;
      continue;
    }

    // Use the claimed database record, rather than
    // the earlier queue snapshot.
    const notification = claimed[0] as Notification;

// Check the latest email preference before sending.
// Staff notifications are exempt from player opt-outs.
const { data: notificationDetails, error: detailsError } =
  await supabaseAdmin
    .from("club_rating_notifications")
    .select(`
      notification_type,
      club_rating_player_id,
      club_rating_players (
        email_opted_out
      )
    `)
    .eq("id", notification.id)
    .single();

if (detailsError || !notificationDetails) {
  throw new Error(
    detailsError?.message ??
      "Unable to verify notification preferences."
  );
}

const isStaffNotification = [
  "missing_email",
  "podplay_update",
].includes(notificationDetails.notification_type);

if (!isStaffNotification) {
  const { data: player, error: playerError } =
    await supabaseAdmin
      .from("club_rating_players")
      .select("email_opted_out")
      .eq(
        "id",
        notificationDetails.club_rating_player_id
      )
      .single();

  if (playerError || !player || player.email_opted_out) {
    const { error: cancelError } = await supabaseAdmin
      .from("club_rating_notifications")
      .update({ delivery_status: "cancelled" })
      .eq("id", notification.id)
      .eq("delivery_status", "sending");

    if (cancelError) {
      throw new Error(cancelError.message);
    }

    result.skipped++;
    continue;
  }
}

try {
  const messageId = await sendPB101Email({
        to: notification.recipient_email,
        subject: notification.subject,
        text: notification.message_body,
      });

      const { data: updated, error: sentError } =
        await supabaseAdmin
          .from("club_rating_notifications")
          .update({
            delivery_status: "sent",
            gmail_message_id: messageId,
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", notification.id)
          .eq("delivery_status", "sending")
          .select("id")
          .maybeSingle();

      if (sentError || !updated) {
        throw new Error(
          sentError?.message ??
            "Unable to confirm notification delivery."
        );
      }

      result.sent++;
    } catch (sendError) {
      console.error(
        "Club Rating email processing failed:",
        notification.id,
        sendError
      );

      // Do not automatically retry uncertain deliveries.
      // Gmail may have accepted the message even if a
      // subsequent database update failed.
      const { error: failureError } =
        await supabaseAdmin
          .from("club_rating_notifications")
          .update({
            delivery_status: "failed",
            last_error:
              sendError instanceof Error
                ? sendError.message.slice(0, 1000)
                : "Unknown processing error.",
          })
          .eq("id", notification.id)
          .eq("delivery_status", "sending");

      if (failureError) {
        console.error(
          "Unable to record notification failure:",
          failureError
        );
      }

      result.failed++;
    }
  }

  return result;
}
