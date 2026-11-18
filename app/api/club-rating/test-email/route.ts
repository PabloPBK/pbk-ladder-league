
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { sendPB101Email } from "@/lib/server/pb101-gmail";

export const runtime = "nodejs";

const TEST_EMAIL = "info@pickleballkingdomlynnwood.com";

const testMessages = [
  {
    subject: "[TEST] PBK Club Rating - Current",
    text: `Hi Test Player,

Your PBK Club Rating information is ready.

Club Rating: 3.750
Status: Current
Qualification Date: November 1, 2026

Your rating is currently qualified. Continue participating in qualifying sessions to maintain your rating reliability.

This is a TEST email. No player information has been changed.

Pickleball Kingdom Lynnwood`,
  },
  {
    subject: "[TEST] PBK Club Rating - Below 50% Reliability",
    text: `Hi Test Player,

Your PBK Club Rating information is ready.

Club Rating: 3.750
Status: Below 50% Reliability

Your historical rating has been preserved, but your reliability is currently below 50%.

Additional qualifying sessions can help you improve your rating reliability.

This is a TEST email. No player information has been changed.

Pickleball Kingdom Lynnwood`,
  },
  {
    subject: "[TEST] PBK Club Rating - Provisional",
    text: `Hi Test Player,

Your PBK Club Rating information is ready.

Recorded Rating: 3.750
Status: Provisional

Your historical rating has been preserved. However, you have not yet completed the requirements for an officially qualified Club Rating.

Our Club Rating program requires two qualifying sessions of six PB Vision-rated games each.

This is a TEST email. No player information has been changed.

Pickleball Kingdom Lynnwood`,
  },
];

export async function POST() {
  try {
    await requireStaffUser();

    const results = [];

    for (const message of testMessages) {
      const messageId = await sendPB101Email({
        to: TEST_EMAIL,
        subject: message.subject,
        text: message.text,
      });

      results.push({
        subject: message.subject,
        messageId,
      });
    }

    return NextResponse.json({
      success: true,
      recipient: TEST_EMAIL,
      sent: results.length,
      results,
    });
  } catch (error) {
    console.error("Club Rating test email failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to complete Club Rating email test.",
      },
      { status: 500 }
    );
  }
}
