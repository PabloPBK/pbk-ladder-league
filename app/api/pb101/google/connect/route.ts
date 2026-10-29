
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireStaffUser();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials are not configured." },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/pb101/google/callback`;

    const state = randomBytes(32).toString("hex");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/gmail.send",
      access_type: "offline",
      prompt: "consent",
      state,
      login_hint: "pablo@pickleballkingdomlynnwood.com",
    });

    const response = NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );

    response.cookies.set("pb101_google_oauth_state", state, {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      path: "/api/pb101/google",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error("PB101 Google OAuth connection error:", error);

    return NextResponse.json(
      { error: "Unable to start Google authorization." },
      { status: 403 }
    );
  }
}
