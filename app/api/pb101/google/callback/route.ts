
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SENDER_EMAIL = "pablo@pickleballkingdomlynnwood.com";

function redirectWithStatus(
  request: NextRequest,
  status: string
) {
  const url = new URL("/admin/pb101/emails", request.url);
  url.searchParams.set("google", status);

  const response = NextResponse.redirect(url);

  response.cookies.set("pb101_google_oauth_state", "", {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/pb101/google",
    maxAge: 0,
  });

  return response;
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffUser();
  } catch {
    return redirectWithStatus(request, "unauthorized");
  }

  const params = request.nextUrl.searchParams;

  if (params.has("error")) {
    return redirectWithStatus(request, "denied");
  }

  const receivedState = params.get("state");
  const savedState = request.cookies.get(
    "pb101_google_oauth_state"
  )?.value;

  if (!receivedState || !savedState) {
    return redirectWithStatus(request, "invalid_state");
  }

  const received = Buffer.from(receivedState);
  const saved = Buffer.from(savedState);

  if (
    received.length !== saved.length ||
    !timingSafeEqual(received, saved)
  ) {
    return redirectWithStatus(request, "invalid_state");
  }

  const code = params.get("code");

  if (!code) {
    return redirectWithStatus(request, "missing_code");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithStatus(request, "missing_config");
  }

  const redirectUri = new URL(
    "/api/pb101/google/callback",
    request.url
  ).toString();

  try {
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        cache: "no-store",
      }
    );

    if (!tokenResponse.ok) {
      console.error(
        "Google token exchange failed:",
        tokenResponse.status
      );
      return redirectWithStatus(request, "token_error");
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };

    if (!tokens.refresh_token || !tokens.access_token) {
      return redirectWithStatus(request, "no_refresh_token");
    }

    const scopes = new Set(
      (tokens.scope ?? "").split(" ").filter(Boolean)
    );

    if (
      !scopes.has(
        "https://www.googleapis.com/auth/gmail.send"
      )
    ) {
      return redirectWithStatus(request, "missing_scope");
    }

    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        cache: "no-store",
      }
    );

    if (!profileResponse.ok) {
      return redirectWithStatus(request, "profile_error");
    }

    const profile = (await profileResponse.json()) as {
      emailAddress?: string;
    };

    if (
      profile.emailAddress?.toLowerCase() !==
      SENDER_EMAIL.toLowerCase()
    ) {
      return redirectWithStatus(request, "wrong_account");
    }

    const { error } = await supabaseAdmin
      .from("pb101_google_oauth")
      .upsert(
        {
          id: 1,
          sender_email: SENDER_EMAIL,
          refresh_token: tokens.refresh_token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error(
        "Unable to store Google OAuth credentials:",
        error.message
      );
      return redirectWithStatus(request, "storage_error");
    }

    return redirectWithStatus(request, "connected");
  } catch (error) {
    console.error("PB101 Google OAuth callback failed:", error);
    return redirectWithStatus(request, "error");
  }
}
