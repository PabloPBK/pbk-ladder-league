"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SessionPayoutEstimate } from "@/components/admin/LeagueSessionRevenue";

const field = "min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white";
const button = "min-h-10 rounded-lg border border-zinc-600 px-3 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50";

export default function LeaguePlanForm() {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const pending = useRef(false);
  const [seasons, setSeasons] = useState<string[][]>([[]]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sessionCount = seasons.reduce((sum, dates) => sum + dates.filter(Boolean).length, 0);

  function updateSeason(index: number, change: (dates: string[]) => string[]) {
    setSeasons((previous) => previous.map((dates, i) => i === index ? change(dates) : dates));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;

    const form = new FormData(event.currentTarget);
    requestId.current ??= crypto.randomUUID();
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/leagues/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: requestId.current, name: form.get("name"), description: form.get("description"), seasons }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create the league.");
      router.push("/admin?" + new URLSearchParams({ leagueId: result.leagueId, seasonId: result.seasonId }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to create the league.");
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SessionPayoutEstimate disabled={saving} plannedSessions={Math.max(1, sessionCount)} />
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <fieldset disabled={saving} className="space-y-4">
          <label className="grid gap-1 text-sm font-semibold">
            League name
            <input name="name" required maxLength={180} className={field} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Description (optional)
            <textarea name="description" maxLength={1000} rows={2} className={field} />
          </label>
          <div>
            <h2 className="font-bold">Seasons and session dates</h2>
            <p className="mt-1 text-sm text-zinc-400">Dates are optional. The hub numbers each season’s sessions in date order. Use the same dates when setting up registration in PodPlay.</p>
          </div>
          {seasons.map((dates, seasonIndex) => (
            <fieldset key={seasonIndex} className="rounded-xl border border-zinc-700 p-4">
              <legend className="px-2 font-semibold">Season {seasonIndex + 1}</legend>
              {dates.map((date, dateIndex) => (
                <div key={dateIndex} className="mb-2 flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-sm">
                    Session date
                    <input aria-label={`Season ${seasonIndex + 1} session date ${dateIndex + 1}`} className={field}
                      type="date" value={date} onChange={(event) => {
                        const value = event.target.value;
                        updateSeason(seasonIndex, (rows) => rows.map((row, i) => i === dateIndex ? value : row));
                      }} />
                  </label>
                  <button type="button" className={button} aria-label={`Remove Season ${seasonIndex + 1} session date ${dateIndex + 1}`}
                    onClick={() => updateSeason(seasonIndex, (rows) => rows.filter((_, i) => i !== dateIndex))}>Remove</button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={button} onClick={() => updateSeason(seasonIndex, (rows) => [...rows, ""])}>
                  Add session date
                </button>
                {seasons.length > 1 && (
                  <button type="button" className={button} onClick={() => setSeasons((previous) => previous.filter((_, i) => i !== seasonIndex))}>
                    Remove Season {seasonIndex + 1}
                  </button>
                )}
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={() => setSeasons((previous) => [...previous, []])} className={button}>Add season</button>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-yellow-400 px-5 font-bold text-zinc-950 disabled:opacity-50">
          {saving ? "Creating league…" : "Create league and seasons"}
        </button>
      </form>
    </div>
  );
}
