import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ shortCode: string }>;
};

export default async function ShortTVPage({
  params,
}: PageProps) {
  const { shortCode } = await params;

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

  const { data: screen, error } = await db
    .from("tv_screens")
    .select("id, name, is_active")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!screen || !screen.is_active) {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-yellow-400">
          Pickleball Kingdom
        </h1>
        <p className="mt-4 text-xl">{screen.name}</p>
        <p className="mt-3 text-zinc-400">
          TV screen connected successfully.
        </p>
      </div>
    </main>
  );
}
