
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPB101Email } from "./pb101-gmail";

const MAX_PER_RUN = 10;

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
  notification_type: string;
  club_rating_player_id: string | null;
};

const STAFF_NOTIFICATION_TYPES = new Set([
  "missing_email",
  "podplay_update",
]);

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
    .select("id")
    .eq("delivery_status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    throw new Error(
      `Unable to load Club Rating email queue: ${error.message}`
    );
  }

  for (const item of pending ?? []) {
    result.checked++;

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

    const notification = claimed[0] as Notification;

    try {
      // Reload the claimed record to verify its current
      // notification type, player ID, and delivery status.
      const { data: details, error: detailsError } =
        await supabaseAdmin
          .from("club_rating_notifications")
          .select(
            "notification_type, club_rating_player_id, delivery_status"
          )
          .eq("id", notification.id)
          .single();

      if (detailsError || !details) {
        throw new Error(
          detailsError?.message ??
            "Unable to verify notification."
        );
      }

      if (details.delivery_status !== "sending") {
        result.skipped++;
        continue;
      }

      const isStaffNotification =
        STAFF_NOTIFICATION_TYPES.has(
          details.notification_type
        );

      if (!isStaffNotification) {
        // Fail closed if the player cannot be identified.
        if (!details.club_rating_player_id) {
          throw new Error(
            "Player notification has no player ID."
          );
        }

        const { data: player, error: playerError } =
          await supabaseAdmin
            .from("club_rating_players")
            .select("email_opted_out, email")
            .eq("id", details.club_rating_player_id)
            .single();

        if (playerError || !player) {
          throw new Error(
            playerError?.message ??
              "Unable to verify player email preferences."
          );
        }

        // Do not send to opted-out players.
        // Also prevent delivery to a stale email address.
        const emailMatches =
          typeof player.email === "string" &&
          player.email.trim().toLowerCase() ===
            notification.recipient_email
              .trim()
              .toLowerCase();

        if (player.email_opted_out || !emailMatches) {
          const { data: cancelled, error: cancelError } =
            await supabaseAdmin
              .from("club_rating_notifications")
              .update({
                delivery_status: "cancelled",
                last_error: player.email_opted_out
                  ? "Player opted out of email notifications."
                  : "Player email address changed.",
              })
              .eq("id", notification.id)
              .eq("delivery_status", "sending")
              .select("id")
              .maybeSingle();

          if (cancelError || !cancelled) {
            throw new Error(
              cancelError?.message ??
                "Unable to cancel notification."
            );
          }

          result.skipped++;
          continue;
        }
      }

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
