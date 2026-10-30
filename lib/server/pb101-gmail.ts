
import {
  createDecipheriv,
} from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SENDER_EMAIL =
  "pablo@pickleballkingdomlynnwood.com";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

function decryptRefreshToken(
  encryptedToken: string
): string {
  const keyHex =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  if (
    !keyHex ||
    !/^[0-9a-fA-F]{64}$/.test(keyHex)
  ) {
    throw new Error(
      "Google token encryption key is missing or invalid."
    );
  }

  const parts = encryptedToken.split(":");

  if (
    parts.length !== 4 ||
    parts[0] !== "v1"
  ) {
    throw new Error(
      "Unsupported Gmail token format."
    );
  }

  const [, ivEncoded, tagEncoded, dataEncoded] =
    parts;

  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const encrypted = Buffer.from(
    dataEncoded,
    "base64url"
  );

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error(
      "Invalid encrypted Gmail token."
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(
    value,
    "utf8"
  ).toString("base64")}?=`;
}

function validateHeader(
  value: string,
  field: string
) {
  if (/[\r\n]/.test(value)) {
    throw new Error(
      `Invalid ${field}: line breaks are not allowed.`
    );
  }
}

export async function sendPB101Email({
  to,
  subject,
  text,
}: SendEmailInput): Promise<string> {
  validateHeader(to, "recipient");
  validateHeader(subject, "subject");

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  ) {
    throw new Error(
      "A valid recipient email is required."
    );
  }

  if (!subject.trim() || !text.trim()) {
    throw new Error(
      "Email subject and message are required."
    );
  }

  const clientId =
    process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials are missing."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("pb101_google_oauth")
    .select("sender_email, refresh_token")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Gmail is not connected."
    );
  }

  if (
    data.sender_email?.toLowerCase() !==
    SENDER_EMAIL
  ) {
    throw new Error(
      "Unexpected Gmail sending account."
    );
  }

  const refreshToken = decryptRefreshToken(
    data.refresh_token
  );

  const tokenResponse = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(
      `Unable to refresh Gmail access token (${tokenResponse.status}).`
    );
  }

  const tokenData =
    (await tokenResponse.json()) as {
      access_token?: string;
    };

  if (!tokenData.access_token) {
    throw new Error(
      "Google did not return an access token."
    );
  }

  const normalizedText = text.replace(
    /\r?\n/g,
    "\r\n"
  );

  const message = [
    `From: ${SENDER_EMAIL}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(
      normalizedText,
      "utf8"
    ).toString("base64"),
  ].join("\r\n");

  const raw = Buffer.from(
    message,
    "utf8"
  ).toString("base64url");

  const sendResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      cache: "no-store",
    }
  );

  if (!sendResponse.ok) {
    throw new Error(
      `Gmail rejected the message (${sendResponse.status}).`
    );
  }

  const result =
    (await sendResponse.json()) as {
      id?: string;
    };

  if (!result.id) {
    throw new Error(
      "Gmail did not confirm a message ID."
    );
  }

  return result.id;
}
