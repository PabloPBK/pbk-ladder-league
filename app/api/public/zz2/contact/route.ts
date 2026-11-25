import { NextResponse } from "next/server";

// Older open tabs used this endpoint. Return an error so visitors keep their draft.
export function POST() {
  return NextResponse.json({
    error: "Please reload the Contact page or email pablo@zz2pickleball.com directly.",
  }, {
    status: 410,
    headers: {
      "Access-Control-Allow-Origin": "https://zz2-pickleball.vercel.app",
      "Cache-Control": "no-store",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://zz2-pickleball.vercel.app",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
