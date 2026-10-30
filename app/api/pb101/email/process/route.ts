
import { NextRequest, NextResponse } from "next/server";
import { processPB101EmailQueue } from "@/lib/server/pb101-email-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Cron authentication is not configured." },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const result = await processPB101EmailQueue();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("PB101 email worker error:", error);

    return NextResponse.json(
      { error: "Unable to process PB101 email queue." },
      { status: 500 }
    );
  }
}
