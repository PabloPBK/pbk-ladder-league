import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { readContactInquiry } from "@/zz2-site/lib/contact";

const publicSite = "https://zz2-pickleball.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": publicSite,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  Vary: "Origin",
};

export function OPTIONS(request: Request) {
  return request.headers.get("origin") === publicSite
    ? new Response(null, { status: 204, headers: corsHeaders })
    : new Response(null, { status: 403 });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== publicSite) return new Response(null, { status: 403 });

  const reply = (status: number, body: { sent: true } | { error: string }) =>
    NextResponse.json(body, { status, headers: corsHeaders });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply(415, { error: "Send the form from the Contact page." });
  }
  const maxBytes = 24000;
  if (Number(request.headers.get("content-length")) > maxBytes) return reply(413, { error: "The message is too long." });

  let data;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > maxBytes) return reply(413, { error: "The message is too long." });
    data = JSON.parse(rawBody);
  } catch {
    return reply(400, { error: "We couldn’t read your message. Please try again." });
  }

  if (typeof data?.website === "string" && data.website.trim()) return reply(200, { sent: true });

  let inquiry;
  try {
    inquiry = readContactInquiry(data);
  } catch (error) {
    return reply(400, { error: error instanceof Error ? error.message : "Check the form and try again." });
  }
  if (Object.values(inquiry).some((value) => value.includes("\0"))) return reply(400, { error: "Remove invalid characters and try again." });

  const ip = request.headers.get("x-vercel-forwarded-for")?.trim() ?? "";
  const secret = process.env.LEAGUE_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY!;
  const rateKey = createHmac("sha256", secret)
    .update("zz2-contact:v1:" + (isIP(ip) ? ip : "unknown"))
    .digest("hex");

  const result = await supabaseAdmin.rpc("submit_zz2_contact_inquiry", {
    sender_name: inquiry.name, sender_email: inquiry.email, topic: inquiry.topic, message: inquiry.message, rate_key: rateKey,
  });
  if (result.error) {
    console.error("Unable to save ZZ2 inquiry:", result.error.code);
    return reply(503, { error: "We couldn’t save your message right now. Please try again or email ZZ2 directly." });
  }
  if (result.data !== true) return reply(429, { error: "Too many messages were sent from this connection. Try again later or email ZZ2 directly." });
  return reply(201, { sent: true });
}
