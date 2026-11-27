import { NextResponse } from "next/server";
import { getRevenueApiDenial } from "@/lib/server/require-revenue-admin";

export async function GET() {
  const denial = await getRevenueApiDenial();
  if (denial) return denial;
  return NextResponse.json({ allowed: true }, { headers: { "Cache-Control": "private, no-store" } });
}
