
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SENDER_EMAIL = "pablo@pickleballkingdomlynnwood.com";

const GMAIL_SEND_SCOPE =
  "https://www.googleapis.com/auth/gmail.send";

function redirectWithStatus(
  request: NextRequest,
  status: string
) {
  const url = new URL(
    "/admin/pb101/emails",
    request.url
  );

  url.searchParams.set("google", status);

  const response = NextResponse.redirect(url);

  response.cookies.set(
    "pb101_google_oauth_state",
    "",
    {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/api/pb101/google",
      maxAge: 0,
    }
  );

  return response;
}

export async function GET(request: NextRequest) {
  // Only authenticated staff can complete authorization.
  try {
    await requireStaffUser();
  } catch {
    return redirectWithStatus(
      request,
      "unauthorized"
    );
  }

  const params = request.nextUrl.searchParams;

  if (params.has("error")) {
    return redirectWithStatus(
      request,
      "denied"
    );
  }

  // Verify OAuth state to prevent CSRF.
  const receivedState = params.get("state");

  const savedState = request.cookies.get(
    "pb101_google_oauth_state"
  )?.value;

  if (!receivedState || !savedState) {
    return redirectWithStatus(
      request,
      "invalid_state"
    );
  }

  const received = Buffer.from(receivedState);
  const saved = Buffer.from(savedState);

  if (
    received.length !== saved.length ||
    !timingSafeEqual(received, saved)
  ) {
    return redirectWithStatus(
      request,
      "invalid_state"
    );
  }

  const code = params.get("code");

  if (!code) {
    return redirectWithStatus(
      request,
      "missing_code"
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithStatus(
      request,
      "missing_config"
    );
  }

  const redirectUri = new URL(
    "/api/pb101/google/callback",
    request.url
  ).toString();

  try {
    // Exchange Google's one-time authorization code
    // for access and refresh tokens.
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
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

      return redirectWithStatus(
        request,
        "token_error"
      );
    }

    const tokens =
      (await tokenResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
        scope?: string;
      };

    if (
      !tokens.access_token ||
      !tokens.refresh_token
    ) {
      return redirectWithStatus(
        request,
        "no_refresh_token"
      );
    }

    // Ensure Google granted the required
    // Gmail send-only permission.
    const scopes = new Set(
      (tokens.scope ?? "")
        .split(" ")
        .filter(Boolean)
    );

    if (!scopes.has(GMAIL_SEND_SCOPE)) {
      return redirectWithStatus(
        request,
        "missing_scope"
      );
    }

    // Confirm the Google account identity using
    // Google's token information endpoint.
    // This does not require Gmail inbox access.
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(
        tokens.access_token
      )}`,
      {
        cache: "no-store",
      }
    );

    if (!tokenInfoResponse.ok) {
      return redirectWithStatus(
        request,
        "identity_error"
      );
    }

    const tokenInfo =
      (await tokenInfoResponse.json()) as {
        email?: string;
        verified_email?: boolean | string;
        aud?: string;
      };

    // The token must belong to our OAuth client.
    if (tokenInfo.aud !== clientId) {
      return redirectWithStatus(
        request,
        "wrong_client"
      );
    }

    // Only connect Pablo's Workspace account.
    if (
      !tokenInfo.email ||
      tokenInfo.email.toLowerCase() !==
        SENDER_EMAIL.toLowerCase()
    ) {
      return redirectWithStatus(
        request,
        "wrong_account"
      );
    }

    // Store the refresh token server-side.
    const { error } = await supabaseAdmin
      .from("pb101_google_oauth")
      .upsert(
        {
          id: 1,
          sender_email: SENDER_EMAIL,
          refresh_token: tokens.refresh_token,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    if (error) {
      console.error(
        "Unable to store Google OAuth credentials:",
        error.message
      );

      return redirectWithStatus(
        request,
        "storage_error"
      );
    }

    return redirectWithStatus(
      request,
      "connected"
    );
  } catch (error) {
    console.error(
      "PB101 Google OAuth callback failed:",
      error
    );

    return redirectWithStatus(
      request,
      "error"
    );
  }
}
