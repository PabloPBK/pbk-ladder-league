"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useFrontDesk } from "@/components/auth/useFrontDesk";
import { AppLayout } from "@/components/layout/AppLayout";
import { rosterWorkspace, type LeagueDirectory } from "@/lib/data/league-directory";

export default function LeaguesPage() {
  const frontDesk = useFrontDesk();
  const [directory, setDirectory] = useState<LeagueDirectory>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/league-directory", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to open the league directory." : "Unable to load leagues.");
        const result = await response.json() as LeagueDirectory;
        if (!controller.signal.aborted) setDirectory(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load leagues.");
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  function leagueCards(entries: LeagueDirectory["current"]) {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(({ href, label }) => (
        <Link key={href} href={href} prefetch={false} className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 font-bold text-white hover:border-yellow-500 hover:text-yellow-300">
          {label}
        </Link>
      ))}
    </div>;
  }

  return (
    <AppLayout title="Leagues" description="Choose the league and season or event you’re running.">
      <div className="mx-auto max-w-6xl space-y-7">
        {frontDesk === false && (
          <div className="flex flex-wrap gap-4 text-sm text-blue-300">
            <Link href="/admin/leagues/new">Create League</Link>
            <Link href={rosterWorkspace}>Partnered League Management</Link>
            <Link href="/admin">League setup</Link>
            <Link href="/walking">Score Management</Link>
            <Link href="/tv">Daily Standings</Link>
            <Link href="/display">Season Standings</Link>
            <Link href="/stats">Stats</Link>
            <Link href="/history">History</Link>
          </div>
        )}
        {!directory && !error && <p role="status" className="text-zinc-400">Loading leagues…</p>}
        {error && <div role="alert" className="text-amber-300">
          {error} <button type="button" className="underline" onClick={() => { setError(""); setAttempt(attempt + 1); }}>Try again</button>
          <Link className="ml-3 underline" href="/login?next=/leagues">Sign in</Link>
        </div>}
        {directory && <>
          {directory.current.length ? leagueCards(directory.current) : <p className="text-zinc-400">No current or upcoming leagues.</p>}
          <details className="space-y-3 border-t border-zinc-800 pt-4">
            <summary className="cursor-pointer font-semibold text-zinc-300">Past Leagues</summary>
            {directory.past.length ? leagueCards(directory.past) : <p className="text-zinc-400">No past leagues.</p>}
          </details>
        </>}
      </div>
    </AppLayout>
  );
}
