
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/server/require-auth";
import { sendPB101Email } from "@/lib/server/pb101-gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEST_EMAIL = "pablo@pickleballkingdomlynnwood.com";
const PRODUCTION_ORIGIN = "https://leagues.zz2pickleball.com";

export async function POST(request: Request) {
  try {
    await requireStaffUser();
  } catch {
    return NextResponse.json(
      { success: false, error: "Staff authorization required." },
      { status: 403 }
    );
  }

  const origin = request.headers.get("origin");

  // Only accept requests from our production website.
  if (origin !== PRODUCTION_ORIGIN) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Please use leagues.zz2pickleball.com to send the test email.",
      },
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
      {
        success: false,
        error: "Unable to send the test email. Check Vercel logs.",
      },
      { status: 500 }
    );
  }
}
