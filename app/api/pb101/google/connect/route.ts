
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

const REDIRECT_URI =
  "https://leagues.zz2pickleball.com/api/pb101/google/callback";

export async function GET(request: NextRequest) {
  try {
    await requireStaffUser();
  } catch {
    return NextResponse.json(
      { error: "Staff authorization required." },
      { status: 403 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth client ID is not configured." },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
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
    secure: true,
    sameSite: "lax",
    path: "/api/pb101/google",
    maxAge: 600,
  });

  return response;
}
