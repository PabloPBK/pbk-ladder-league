"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatPrizeMoney } from "@/zz2-site/lib/league-contract";
import { parsePrizeAmount } from "@/lib/data/league-prize";
import {
  calculateSessionRevenue, defaultEntryFees, estimatePaidEntries, isPaidPlayerCount, maxPayingPlayers, paidEntryMix,
  type HistoricalPaidEntries, type SavedSessionRevenue,
} from "@/lib/data/league-session-revenue";

type RevenueDraft = { members: string; nonmembers: string };

const emptyRevenueDraft: RevenueDraft = { members: "", nonmembers: "" };

function readDraft({ members, nonmembers }: RevenueDraft) {
  return {
    memberCount: members === "" ? null : Number(members),
    nonmemberCount: nonmembers === "" ? null : Number(nonmembers),
  };
}

function PayoutFields({
  draft, onChange, estimating = false, disabled = false, showCounts = true, fees = defaultEntryFees, sessions = 1,
}: {
  draft: RevenueDraft;
  onChange: (draft: RevenueDraft) => void;
  estimating?: boolean;
  disabled?: boolean;
  showCounts?: boolean;
  fees?: typeof defaultEntryFees;
  sessions?: number;
}) {
  const { memberCount, nonmemberCount } = readDraft(draft);
  const totals = calculateSessionRevenue(
    isPaidPlayerCount(memberCount) ? memberCount : 0,
    isPaidPlayerCount(nonmemberCount) ? nonmemberCount : 0,
    fees,
  );
  const figures = [
    [estimating ? "Expected paying players" : "Paid players", totals.players.toString()],
    ["Gross revenue", formatPrizeMoney(totals.gross)],
    ["Session payout · 15%", formatPrizeMoney(totals.sessionPayout)],
    ["Season payout contribution · 15%", formatPrizeMoney(totals.seasonContribution)],
    ["Total payout · 30%", formatPrizeMoney(totals.totalPayout)],
    ["Remaining revenue · 70%", formatPrizeMoney(totals.clubRevenue)],
    ...(sessions > 1 ? [
      [`Gross revenue for ${sessions} sessions`, formatPrizeMoney(totals.gross * sessions)],
      ["Projected season payout set-aside", formatPrizeMoney(totals.seasonContribution * sessions)],
    ] : []),
  ];

  return (
    <>
      {showCounts && <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Members · {formatPrizeMoney(fees.memberCents)} each
          <input aria-label={estimating ? "Expected paying members" : "Paying members"}
            type="number" inputMode="numeric" min={0} max={maxPayingPlayers} step={1}
            required={!estimating} value={draft.members} onChange={(event) => onChange({ ...draft, members: event.target.value })}
            disabled={disabled} className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Non-members · {formatPrizeMoney(fees.nonmemberCents)} each
          <input aria-label={estimating ? "Expected paying non-members" : "Paying non-members"}
            type="number" inputMode="numeric" min={0} max={maxPayingPlayers} step={1}
            required={!estimating} value={draft.nonmembers} onChange={(event) => onChange({ ...draft, nonmembers: event.target.value })}
            disabled={disabled} className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3" />
        </label>
      </div>}
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
            <dt className="text-sm text-zinc-300">{label}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

const estimateInputClass = "min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white";

function readFee(value: string) {
  try {
    return parsePrizeAmount(value);
  } catch {
    return null;
  }
}

export function SessionPayoutEstimate({
  leagueId, plannedSessions,
}: { leagueId: string; plannedSessions: number }) {
  const [manualDraft, setDraft] = useState(emptyRevenueDraft);
  const [mode, setMode] = useState<"manual" | "history">("manual");
  const [expected, setExpected] = useState("");
  const [memberFee, setMemberFee] = useState((defaultEntryFees.memberCents / 100).toFixed(2));
  const [nonmemberFee, setNonmemberFee] = useState((defaultEntryFees.nonmemberCents / 100).toFixed(2));
  const [customSessions, setCustomSessions] = useState<string>();
  const [history, setHistory] = useState<{ leagueId: string; mix: HistoricalPaidEntries | null; error?: string }>();

  useEffect(() => {
    if (mode !== "history") return;

    const abort = new AbortController();
    async function loadHistory() {
      try {
        const query = leagueId ? "?" + new URLSearchParams({ leagueId }) : "";
        const response = await fetch("/api/league-revenue/history" + query, { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error();
        const { mix } = await response.json() as { mix: HistoricalPaidEntries | null };
        if (!abort.signal.aborted) setHistory({ leagueId, mix });
      } catch {
        if (!abort.signal.aborted) setHistory({ leagueId, mix: null, error: "Unable to load history. Enter the counts manually." });
      }
    }
    void loadHistory();
    return () => abort.abort();
  }, [mode, leagueId]);

  const loaded = history?.leagueId === leagueId ? history : undefined;
  const source = loaded?.mix;
  const mix = source ? paidEntryMix(source.members, source.nonmembers) : null;
  const projected = source && expected !== "" ? estimatePaidEntries(Number(expected), source) : null;
  const projectedDraft = projected ? { members: String(projected.members), nonmembers: String(projected.nonmembers) } : null;
  const memberCents = readFee(memberFee);
  const nonmemberCents = readFee(nonmemberFee);
  const feesValid = memberCents !== null && nonmemberCents !== null;
  const sessionInput = customSessions ?? String(plannedSessions);
  const seasonCount = Number(sessionInput);
  const countValid = Number.isInteger(seasonCount) && seasonCount > 0 && seasonCount <= 10000;

  return (
    <section className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-white">
      <div className="mt-3 space-y-3">
        <p className="text-sm text-zinc-400">
          Estimate paid entries per session. You can adjust the fees for this forecast.
        </p>
        <label className="grid gap-1 text-sm font-semibold sm:max-w-xs">
          Membership estimate
          <select className={estimateInputClass} value={mode}
            onChange={(event) => setMode(event.target.value === "history" ? "history" : "manual")}>
            <option value="manual">Enter counts manually</option>
            <option value="history">Use past paid entries</option>
          </select>
        </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">
              Member fee ($)
              <input className={estimateInputClass} type="text" inputMode="decimal" value={memberFee}
                onChange={(event) => setMemberFee(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Non-member fee ($)
              <input className={estimateInputClass} type="text" inputMode="decimal" value={nonmemberFee}
                onChange={(event) => setNonmemberFee(event.target.value)} />
            </label>
              <label className="grid gap-1 text-sm font-semibold">
                Sessions in forecast
                <input className={estimateInputClass} type="number" min={1} step={1} value={sessionInput}
                  onChange={(event) => setCustomSessions(event.target.value)} />
              </label>
          </div>
        {!feesValid && <p className="text-sm text-amber-300">Enter a valid fee for each group.</p>}
        {!countValid && <p className="text-sm text-amber-300">Enter a valid number of sessions.</p>}
        {mode === "history" && (
          <div className="space-y-3">
            <p role="status" className="text-sm text-zinc-400">
              {!loaded ? "Loading completed session reports…" : loaded.error ?? (mix && source
                ? `${mix.members.toFixed(1)}% members and ${mix.nonmembers.toFixed(1)}% non-members across ${source.reports} saved ${source.reports === 1 ? "report" : "reports"} ${source.scope === "league" ? "for this league" : "across all leagues"}.`
                : "No completed sessions have saved paid counts yet. Enter the counts manually.")}
            </p>
            {mix && (
              <label className="grid gap-1 text-sm font-semibold sm:max-w-xs">
                Expected paying players per session
                <input className={estimateInputClass} type="number" inputMode="numeric" min={0} max={maxPayingPlayers}
                  step={1} value={expected} onChange={(event) => setExpected(event.target.value)} />
              </label>
            )}
            {projectedDraft && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm">{projectedDraft.members} estimated members · {projectedDraft.nonmembers} estimated non-members</p>
                <button type="button" className="text-sm font-semibold text-yellow-300 underline"
                  onClick={() => { setDraft(projectedDraft); setMode("manual"); }}>
                  Use these counts
                </button>
              </div>
            )}
          </div>
        )}
        {feesValid && (mode === "manual" || projectedDraft) && (
          <PayoutFields draft={mode === "manual" ? manualDraft : projectedDraft ?? emptyRevenueDraft}
            onChange={setDraft} estimating showCounts={mode === "manual"}
            fees={{ memberCents: memberCents ?? 0, nonmemberCents: nonmemberCents ?? 0 }}
            sessions={countValid ? seasonCount : 1} />
        )}
      </div>
    </section>
  );
}

export function LeagueSessionRevenue({ eventId }: { eventId: string }) {
  const endpoint = `/api/events/${encodeURIComponent(eventId)}/revenue`;
  const [report, setReport] = useState<SavedSessionRevenue | null>(null);
  const [draft, setDraft] = useState(emptyRevenueDraft);
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
      if (saved) setDraft({ members: String(saved.member_count), nonmembers: String(saved.nonmember_count) });
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

  const { memberCount, nonmemberCount } = readDraft(draft);
  const validCounts = isPaidPlayerCount(memberCount) && isPaidPlayerCount(nonmemberCount);
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
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save revenue.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready && !error) return null;

  return (
    <section id="session-revenue" className="mb-6 scroll-mt-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-white">
      <h2 className="text-xl font-bold">Session Revenue &amp; Payout</h2>
      <p className="mt-1 text-sm text-zinc-400">Enter or confirm the number of players who paid in each group before saving.</p>
      {ready && (
        <form onSubmit={save} className="mt-4 space-y-4">
          <PayoutFields draft={draft} disabled={saving} onChange={(counts) => {
            setDraft(counts);
            setStatus("");
          }} />
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
