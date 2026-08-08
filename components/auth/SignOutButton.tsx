"use client";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300"
    >
      Sign Out
    </button>
  );
}