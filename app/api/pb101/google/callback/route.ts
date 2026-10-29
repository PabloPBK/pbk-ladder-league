
import { NextRequest, NextResponse } from "next/server";
import {
  createCipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SENDER_EMAIL = "pablo@pickleballkingdomlynnwood.com";
const REDIRECT_URI =
  "https://leagues.zz2pickleball.com/api/pb101/google/callback";
const GMAIL_SEND_SCOPE =
  "https://www.googleapis.com/auth/gmail.send";

function encryptToken(token: string): string {
  const keyHex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid Google token encryption key.");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function redirectWithStatus(
  request: NextRequest,
  status: string
) {
  const url = new URL("/admin/pb101/emails", request.url);
  url.searchParams.set("google", status);

  const response = NextResponse.redirect(url);

  response.cookies.set("pb101_google_oauth_state", "", {
    httpOnly: true,
    secure: true,
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
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
        cache: "no-store",
      }
    );

    if (!tokenResponse.ok) {
      console.error(
        "Google OAuth token exchange failed:",
        tokenResponse.status
      );
      return redirectWithStatus(request, "token_error");
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      id_token?: string;
    };

    if (!tokens.access_token || !tokens.refresh_token) {
      return redirectWithStatus(request, "no_refresh_token");
    }

    const scopes = new Set(
      (tokens.scope ?? "").split(" ").filter(Boolean)
    );

    if (!scopes.has(GMAIL_SEND_SCOPE)) {
      return redirectWithStatus(request, "missing_scope");
    }

    // Verify the Google account through its signed ID token.
    const idToken = tokens.id_token;

    if (!idToken) {
      return redirectWithStatus(request, "identity_error");
    }

    const identityResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        idToken
      )}`,
      { cache: "no-store" }
    );

    if (!identityResponse.ok) {
      return redirectWithStatus(request, "identity_error");
    }

    const identity = (await identityResponse.json()) as {
      aud?: string;
      iss?: string;
      email?: string;
      email_verified?: string | boolean;
    };

    if (
      identity.aud !== clientId ||
      ![
        "accounts.google.com",
        "https://accounts.google.com",
      ].includes(identity.iss ?? "")
    ) {
      return redirectWithStatus(request, "wrong_client");
    }

    if (
      identity.email?.toLowerCase() !== SENDER_EMAIL ||
      !(
        identity.email_verified === true ||
        identity.email_verified === "true"
      )
    ) {
      return redirectWithStatus(request, "wrong_account");
    }

    // Encrypt the refresh token before storing it.
    const encryptedRefreshToken = encryptToken(
      tokens.refresh_token
    );

    const { error } = await supabaseAdmin
      .from("pb101_google_oauth")
      .upsert(
        {
          id: 1,
          sender_email: SENDER_EMAIL,
          refresh_token: encryptedRefreshToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error(
        "Google OAuth storage failed:",
        error.message
      );
      return redirectWithStatus(request, "storage_error");
    }

    return redirectWithStatus(request, "connected");
  } catch (error) {
    console.error("PB101 Google OAuth callback error:", error);
    return redirectWithStatus(request, "error");
  }
}
