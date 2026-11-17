
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  processClubRatingEmailQueue,
} from "@/lib/server/club-rating-email-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Cron authentication is not configured.",
      },
      { status: 503 }
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const result =
      await processClubRatingEmailQueue();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Club Rating email worker error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process Club Rating email queue.",
      },
      { status: 500 }
    );
  }
}
