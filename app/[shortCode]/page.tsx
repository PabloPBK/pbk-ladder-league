import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import TVPlayerPage from "../tv/player/[id]/page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ shortCode: string }>;
};

export default async function ShortTVPage({
  params,
}: PageProps) {
  const { shortCode } = await params;

  // Only allow valid TV short codes.
  if (!/^tv[a-z0-9]{1,30}$/.test(shortCode)) {
    notFound();
  }

  const url = process.env.TV_SUPABASE_URL;
  const key = process.env.TV_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("TV database not configured");
  }

  const db = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Confirm that this TV exists and is active.
  const { data: screen, error } = await db
    .from("tv_screens")
    .select("id, is_active")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!screen || !screen.is_active) {
    notFound();
  }

  // Use the existing TV Player with public access.
  return <TVPlayerPage publicShortCode={shortCode} />;
}
