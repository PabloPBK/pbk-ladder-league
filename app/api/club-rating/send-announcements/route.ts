
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPB101Email } from "@/lib/server/pb101-gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "historical_launch_2026_11";
const BATCH_SIZE = 10;

export async function POST() {
  try {
    await requireStaffUser();

    const { data: pending, error: fetchError } =
      await supabaseAdmin
        .from("club_rating_announcement_emails")
        .select(
          "id, club_rating_player_id, recipient_email, subject, message_body"
        )
        .eq("campaign_key", CAMPAIGN)
        .eq("delivery_status", "pending")
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

    if (fetchError) {
      throw fetchError;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const email of pending ?? []) {
      // Atomically claim this message so another request
      // cannot send the same pending row.
      const { data: claimed, error: claimError } =
        await supabaseAdmin
          .from("club_rating_announcement_emails")
          .update({ delivery_status: "sending" })
          .eq("id", email.id)
          .eq("delivery_status", "pending")
          .select("id")
          .maybeSingle();

      if (claimError) {
        throw claimError;
      }

      if (!claimed) continue;

      const { data: player, error: playerError } =
        await supabaseAdmin
          .from("club_rating_players")
          .select("email_opted_out")
          .eq("id", email.club_rating_player_id)
          .single();

      if (playerError || !player) {
        await supabaseAdmin
          .from("club_rating_announcement_emails")
          .update({
            delivery_status: "failed",
            last_error: "Could not verify player email preferences",
          })
          .eq("id", email.id);

        failed++;
        continue;
      }

      if (player.email_opted_out === true) {
        await supabaseAdmin
          .from("club_rating_announcement_emails")
          .update({
            delivery_status: "cancelled",
            last_error: "Player opted out of email",
          })
          .eq("id", email.id);

        skipped++;
        continue;
      }

      try {
        await sendPB101Email({
          to: email.recipient_email,
          subject: email.subject,
          text: email.message_body,
        });

        const { error: updateError } = await supabaseAdmin
          .from("club_rating_announcement_emails")
          .update({
            delivery_status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", email.id)
          .eq("delivery_status", "sending");

        if (updateError) {
          throw updateError;
        }

        sent++;
      } catch (error) {
        // Do not automatically retry uncertain Gmail outcomes.
        await supabaseAdmin
          .from("club_rating_announcement_emails")
          .update({
            delivery_status: "failed",
            last_error:
              error instanceof Error
                ? error.message
                : "Unknown sending error",
          })
          .eq("id", email.id)
          .eq("delivery_status", "sending");

        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      campaign: CAMPAIGN,
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("Club Rating announcement sender:", error);

    return NextResponse.json(
      { success: false, error: "Unable to process campaign" },
      { status: 500 }
    );
  }
}
