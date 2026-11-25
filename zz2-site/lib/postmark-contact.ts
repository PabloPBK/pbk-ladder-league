import "server-only";
import { inquiryEmail, type ContactInquiry } from "./contact";

export function postmarkContactSettings() {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  if (process.env.ZZ2_CONTACT_ENABLED !== "true" || !token || (token === "POSTMARK_API_TEST" && process.env.VERCEL_ENV === "production")) return null;
  return {
    token,
    from: process.env.ZZ2_POSTMARK_FROM?.trim() || `ZZ2 Pickleball <${inquiryEmail}>`,
  };
}

export async function sendContactInquiry(
  settings: NonNullable<ReturnType<typeof postmarkContactSettings>>,
  inquiry: ContactInquiry,
) {
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": settings.token,
    },
    body: JSON.stringify({
      From: settings.from,
      To: inquiryEmail,
      ReplyTo: inquiry.email,
      Subject: "ZZ2 website inquiry · " + inquiry.topic,
      TextBody: `Name: ${inquiry.name}\nEmail: ${inquiry.email}\nTopic: ${inquiry.topic}\n\n${inquiry.message}`,
      MessageStream: "outbound",
      TrackOpens: false,
      TrackLinks: "None",
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  const delivery = await response.json().catch(() => null);
  if (!response.ok || delivery?.ErrorCode !== 0 || !delivery.MessageID) {
    console.error("Postmark rejected a ZZ2 inquiry", response.status,
      typeof delivery?.ErrorCode === "number" ? delivery.ErrorCode : "");
    return false;
  }
  return true;
}
