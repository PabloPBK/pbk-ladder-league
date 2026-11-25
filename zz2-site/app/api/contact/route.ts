import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { readContactInquiry } from "../../../lib/contact";
import { postmarkContactSettings, sendContactInquiry } from "../../../lib/postmark-contact";

const maxBytes = 24_000;
const windowMs = 15 * 60 * 1000;
// Browsers can retry delivery errors. Use a short, bounded request throttle per instance.
const rate = new Map<string, { count: number; expires: number }>();

function allowSubmission(request: Request, token: string) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.trim() ?? "";
  const key = createHmac("sha256", token).update("zz2-contact:v1:" + (isIP(forwarded) ? forwarded : "unknown")).digest("hex");
  const now = Date.now();
  const bucket = rate.get(key);
  if (bucket && bucket.expires > now) {
    if (bucket.count >= 5) return false;
    bucket.count += 1;
    return true;
  }

  if (rate.size >= 1024) {
    for (const [ip, attempt] of rate) {
      if (attempt.expires <= now) rate.delete(ip);
    }
    if (rate.size >= 1024 && !bucket) return false;
  }
  rate.set(key, { count: 1, expires: now + windowMs });
  return true;
}

const json = (value: { sent: true } | { error: string }, status: number) =>
  NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${host}`) {
    return json({ error: "Send your message from the Contact page." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].toLowerCase() !== "application/json") {
    return json({ error: "Send your message from the Contact page." }, 415);
  }

  const settings = postmarkContactSettings();
  if (!settings) return json({ error: "Automatic delivery is unavailable. Please use the direct email link." }, 503);
  if (Number(request.headers.get("content-length")) > maxBytes) return json({ error: "The message is too long." }, 413);

  let data: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBytes) return json({ error: "The message is too long." }, 413);
    data = JSON.parse(raw);
  } catch {
    return json({ error: "We couldn’t read your message. Please try again." }, 400);
  }
  if (data && typeof data === "object" && "website" in data && data.website) return json({ sent: true }, 200);

  let inquiry;
  try {
    inquiry = readContactInquiry(data);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Check the form and try again." }, 400);
  }
  if (!allowSubmission(request, settings.token)) {
    return json({ error: "Too many messages from this connection. Try again later or email ZZ2 directly." }, 429);
  }

  try {
    if (await sendContactInquiry(settings, inquiry)) return json({ sent: true }, 201);
  } catch {
    console.error("Unable to reach Postmark for ZZ2 contact email");
  }
  return json({ error: "We couldn’t send your message. Try again or use the direct email link." }, 503);
}
