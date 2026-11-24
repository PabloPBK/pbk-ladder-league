"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parsePrizeAmount } from "@/lib/data/league-prize";
import { formatPrizeMoney } from "@/zz2-site/lib/league-contract";

export default function LeagueNightPrize({ eventId }: { eventId: string }) {
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const endpoint = "/api/events/" + encodeURIComponent(eventId) + "/prize-money";

  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: abort.signal });
        if (response.status === 401 || response.status === 403 || abort.signal.aborted) return;
        if (!response.ok) throw new Error("Unable to load prize money. Refresh to try again.");
        const data = await response.json();
        if (!abort.signal.aborted) {
          setAmount(data.amountCents == null ? "" : (data.amountCents / 100).toFixed(2));
          setVisible(true);
        }
      } catch {
        if (!abort.signal.aborted) setError("Unable to load prize money. Refresh to try again.");
      }
    }
    void load();
    return () => abort.abort();
  }, [endpoint]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      parsePrizeAmount(amount);
      const response = await fetch(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save prize money.");
      setAmount(data.amountCents == null ? "" : (data.amountCents / 100).toFixed(2));
      setStatus(data.amountCents == null ? "Prize money cleared." : "Saved " + formatPrizeMoney(data.amountCents) + " for this league night.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save prize money.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible && !error) return null;
  return (
    <form onSubmit={save} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-white">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Prize money (USD)
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} maxLength={9}
            placeholder="0.00" className="w-36 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2" />
        </label>
        <button disabled={busy || !visible} type="submit" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-zinc-950 disabled:opacity-60">
          {busy ? "Saving…" : "Save prize money"}
        </button>
      </div>
      <p className="mt-2 text-sm text-zinc-400">This amount appears with the daily standings after the league night is complete. Leave blank to hide it.</p>
      {status && <p role="status" className="mt-2 text-sm text-green-300">{status}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </form>
  );
}
