"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { rosterWorkspace, type LeagueDirectory } from "@/lib/data/league-directory";

export function LeagueMenu({ onNavigate }: { onNavigate?: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pending = useRef(false);
  const [directory, setDirectory] = useState<LeagueDirectory>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLeagues() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/league-directory", { cache: "no-store" });
      if (!response.ok) throw new Error("Couldn’t load leagues.");
      setDirectory(await response.json());
    } catch {
      setError("Couldn’t load leagues.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  function closeMenu() {
    if (menu.current) menu.current.open = false;
    onNavigate?.();
  }

  const linkClass = "block break-words rounded-md px-2.5 py-2 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white";

  return (
    <details
      ref={menu}
      className="rounded-lg bg-zinc-900"
      onToggle={(event) => {
        if (event.currentTarget.open) void loadLeagues();
      }}
    >
      <summary className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800">
        Leagues
      </summary>

      <div className="space-y-1 px-2 pb-2">
        {loading && !directory && <p role="status" className="px-2 py-2 text-xs text-zinc-400">Loading leagues…</p>}
        {error && (
          <div className="px-2 py-2 text-xs text-amber-300">
            <p role="alert">{error}</p>
            <button type="button" onClick={() => void loadLeagues()} className="mt-1 underline">Try again</button>
          </div>
        )}
        {directory && (
          <>
            {directory.current.map(({ href, label }) => (
              <Link key={href} href={href} prefetch={false} onClick={closeMenu} className={linkClass}>{label}</Link>
            ))}
            {directory.current.length === 0 && <p className="px-2 py-2 text-xs text-zinc-400">No current or upcoming leagues.</p>}
            <details className="border-t border-zinc-700">
              <summary className="cursor-pointer rounded-md px-2.5 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
                Past Leagues
              </summary>
              {directory.past.map(({ href, label }) => (
                <Link key={href} href={href} prefetch={false} onClick={closeMenu} className={linkClass}>{label}</Link>
              ))}
              {directory.past.length === 0 && <p className="px-2 py-2 text-xs text-zinc-400">No past leagues.</p>}
            </details>
          </>
        )}
        <div className="border-t border-zinc-700">
          <Link href="/admin" onClick={closeMenu} className={linkClass}>League Night Setup</Link>
          <Link href={rosterWorkspace} onClick={closeMenu} className={linkClass}>Partnered League Management</Link>
        </div>
      </div>
    </details>
  );
}
