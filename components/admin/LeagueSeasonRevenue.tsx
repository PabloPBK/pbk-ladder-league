"use client";

import { useEffect, useState } from "react";
import { formatPrizeMoney } from "@/zz2-site/lib/league-contract";
import { paidEntryMix, type summarizeSeasonRevenue } from "@/lib/data/league-session-revenue";

type Report = { season: string; totals: ReturnType<typeof summarizeSeasonRevenue> };

export function LeagueSeasonRevenue({ seasonId }: { seasonId: string }) {
  const endpoint = `/api/seasons/${encodeURIComponent(seasonId)}/revenue`;
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");

  useEffect(() => {
    const abort = new AbortController();

    async function loadReport() {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: abort.signal });
        if (response.status === 401 || response.status === 403) return;
        if (!response.ok) throw new Error();
        const result: Report = await response.json();
        if (!abort.signal.aborted) setReport(result);
      } catch {
        if (!abort.signal.aborted) setError("Unable to load the season revenue report.");
      }
    }

    void loadReport();
    return () => abort.abort();
  }, [endpoint]);

  if (!report) return error ? <p role="alert" className="mb-6 text-sm text-red-300">{error}</p> : null;

  const { season, totals } = report;
  const mix = paidEntryMix(totals.members, totals.nonmembers);
  const downloadClass = "inline-flex min-h-10 items-center rounded-lg border border-zinc-600 px-3 text-sm font-semibold hover:bg-zinc-800";

  return (
    <section className="mb-6 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{season} Revenue Report</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {totals.saved} saved {totals.saved === 1 ? "report" : "reports"}
            {totals.missing > 0 && ` · ${totals.missing} completed without a report`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={endpoint + "?format=csv"} className={downloadClass}>Download season revenue CSV</a>
          <a href={endpoint + "?format=pdf"} className={downloadClass}>Download season revenue PDF</a>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-zinc-400">Gross revenue</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums">{formatPrizeMoney(totals.gross)}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-400">End-of-season payout set aside</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-yellow-400">{formatPrizeMoney(totals.seasonContribution)}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-400">Paid entries by membership</dt>
          <dd className="mt-1 text-sm font-semibold">
            {mix ? `${mix.members.toFixed(1)}% members · ${mix.nonmembers.toFixed(1)}% non-members` : "No paid entries recorded"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
