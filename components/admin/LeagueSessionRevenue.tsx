"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatPrizeMoney } from "@/zz2-site/lib/league-contract";
import {
  calculateSessionRevenue, isPaidPlayerCount, maxPayingPlayers, memberFeeCents, nonmemberFeeCents,
  type SavedSessionRevenue,
} from "@/lib/data/league-session-revenue";

export function LeagueSessionRevenue({ eventId, onSaved }: { eventId: string; onSaved?: () => void }) {
  const endpoint = `/api/events/${encodeURIComponent(eventId)}/revenue`;
  const [report, setReport] = useState<SavedSessionRevenue | null>(null);
  const [members, setMembers] = useState("");
  const [nonmembers, setNonmembers] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);

  const loadReport = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      if (response.status === 401 || response.status === 403) return;
      if (!response.ok) throw new Error("Unable to load the revenue report.");
      const { report: saved } = await response.json() as { report: SavedSessionRevenue | null };
      if (signal?.aborted) return;

      setReport(saved);
      setMembers(saved ? String(saved.member_count) : "");
      setNonmembers(saved ? String(saved.nonmember_count) : "");
      setReady(true);
      setReloadRequired(false);
      setError("");
    } catch {
      if (!signal?.aborted) setError("Unable to load the revenue report.");
    }
  }, [endpoint]);

  useEffect(() => {
    const abort = new AbortController();
    void loadReport(abort.signal);
    return () => abort.abort();
  }, [loadReport]);

  const memberCount = members === "" ? null : Number(members);
  const nonmemberCount = nonmembers === "" ? null : Number(nonmembers);
  const validCounts = isPaidPlayerCount(memberCount) && isPaidPlayerCount(nonmemberCount);
  const totals = calculateSessionRevenue(
    isPaidPlayerCount(memberCount) ? memberCount : 0,
    isPaidPlayerCount(nonmemberCount) ? nonmemberCount : 0,
  );
  const savedCounts = Boolean(report && memberCount === report.member_count && nonmemberCount === report.nonmember_count);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !validCounts || reloadRequired) return;

    setStatus("");
    setError("");
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: memberCount, nonmembers: nonmemberCount, revision: report?.revision ?? null }),
      });
      const data = await response.json();
      if (response.status === 409) setReloadRequired(true);
      if (!response.ok) throw new Error(data.error ?? "Unable to save revenue.");
      setReport(data.report);
      setStatus("Revenue report saved.");
      onSaved?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save revenue.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready && !error) return null;

  const figures = [
    ["Paid players", totals.players.toString()],
    ["Gross revenue", formatPrizeMoney(totals.gross)],
    ["Session payout · 15%", formatPrizeMoney(totals.sessionPayout)],
    ["Season payout contribution · 15%", formatPrizeMoney(totals.seasonContribution)],
    ["Total payout · 30%", formatPrizeMoney(totals.totalPayout)],
    ["Remaining revenue · 70%", formatPrizeMoney(totals.clubRevenue)],
  ];

  return (
    <section id="session-revenue" className="mb-6 scroll-mt-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-white">
      <h2 className="text-xl font-bold">Session Revenue &amp; Payout</h2>
      <p className="mt-1 text-sm text-zinc-400">Enter the number of players who paid in each group.</p>
      {ready && (
        <form onSubmit={save} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Members · {formatPrizeMoney(memberFeeCents)} each
              <input aria-label="Paying members" type="number" inputMode="numeric" min={0} max={maxPayingPlayers} step={1}
                required value={members} onChange={(event) => { setMembers(event.target.value); setStatus(""); }}
                disabled={saving} className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Non-members · {formatPrizeMoney(nonmemberFeeCents)} each
              <input aria-label="Paying non-members" type="number" inputMode="numeric" min={0} max={maxPayingPlayers} step={1}
                required value={nonmembers} onChange={(event) => { setNonmembers(event.target.value); setStatus(""); }}
                disabled={saving} className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3" />
            </label>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {figures.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
                <dt className="text-sm text-zinc-300">{label}</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!validCounts || saving || savedCounts || reloadRequired}
              className="min-h-11 rounded-lg bg-yellow-400 px-4 font-bold text-zinc-950 disabled:opacity-50">
              {saving ? "Saving…" : "Save revenue report"}
            </button>
            {savedCounts && (
              <a href={endpoint + "?format=csv"} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-600 px-4 text-sm font-semibold hover:bg-zinc-800">
                Download revenue CSV
              </a>
            )}
          </div>
        </form>
      )}
      {status && <p role="status" className="mt-3 text-sm text-green-300">{status}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {(reloadRequired || (!ready && error)) && (
        <button type="button" onClick={() => void loadReport()} className="mt-2 text-sm font-semibold underline">Reload saved report</button>
      )}
    </section>
  );
}
