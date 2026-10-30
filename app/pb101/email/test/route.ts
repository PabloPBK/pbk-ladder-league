
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { sendPB101Email } from "@/lib/server/pb101-gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEST_EMAIL =
  "pablo@pickleballkingdomlynnwood.com";

export async function POST(request: Request) {
  try {
    await requireStaffUser();
  } catch {
    return NextResponse.json(
      { error: "Staff authorization required." },
      { status: 403 }
    );
  }

  // Require a same-origin request.
  const origin = request.headers.get("origin");

  if (
    origin !== "https://leagues.zz2pickleball.com"
  ) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }

  try {
    const messageId = await sendPB101Email({
      to: TEST_EMAIL,
      subject: "PB101+ Gmail Integration Test",
      text: [
        "Hello,",
        "",
        "This is a test email from the PB101+ Guest Journey system.",
        "",
        "If you received this message, the Gmail API integration is working.",
        "",
        "No automated guest emails have been enabled.",
        "",
        "Pickleball Kingdom Lynnwood",
      ].join("\n"),
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${TEST_EMAIL}.`,
      messageId,
    });
  } catch (error) {
    console.error("PB101 test email failed:", error);

    return NextResponse.json(
      { error: "Unable to send the test email." },
      { status: 500 }
    );
  }
}
