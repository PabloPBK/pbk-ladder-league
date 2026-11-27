"use client";

import { useRef, useState } from "react";

type Mode = "courts" | "standings";
type Screen = { id: string; name: string; location: string | null; is_active: boolean };

export function LeagueTvControls({ eventId }: { eventId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("courts");
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function choose(nextMode: Mode) {
    setMode(nextMode);
    setSelected("");
    setScreens([]);
    setError("");
    setBusy(true);
    dialog.current?.showModal();
    try {
      const response = await fetch("/api/tv-screens", { cache: "no-store" });
      const result = await response.json() as { screens?: Screen[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load TVs.");
      const active = result.screens?.filter((screen) => screen.is_active) ?? [];
      setScreens(active);
      if (!active.length) setError("No active TVs are available.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load TVs.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/tv`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenId: selected, mode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to send to TV.");
      setStatus(`${mode === "courts" ? "Court assignments" : "Session live standings"} sent to ${result.screenName}. The TV returns to its usual display when the session ends.`);
      dialog.current?.close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send to TV.");
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = "min-h-11 rounded-xl border border-zinc-600 px-4 py-2.5 font-semibold hover:bg-zinc-800 disabled:opacity-50";

  return (
    <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4 no-print">
      <h2 className="mb-3 text-lg font-bold">Session TVs</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void choose("courts")} className={buttonStyle}>Show court assignments on TV</button>
        <button type="button" disabled={busy} onClick={() => void choose("standings")} className={buttonStyle}>Session live standings</button>
      </div>
      {status && <p role="status" className="mt-3 text-sm text-green-300">{status}</p>}
      <dialog ref={dialog} aria-labelledby="choose-league-tv" onCancel={(event) => { if (busy) event.preventDefault(); }}
        className="m-auto w-[min(28rem,90vw)] rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-white backdrop:bg-black/75">
        <h3 id="choose-league-tv" className="text-lg font-bold">Choose a TV</h3>
        <p className="mb-3 text-sm text-zinc-300">{mode === "courts" ? "Court assignments" : "Session live standings"}</p>
        <label className="block text-sm">TV
          <select value={selected} disabled={busy || !screens.length} onChange={(event) => setSelected(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
            <option value="">Select a TV</option>
            {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}{screen.location ? ` · ${screen.location}` : ""}</option>)}
          </select>
        </label>
        {busy && <p role="status" className="mt-2 text-sm">Working…</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className={buttonStyle}>Cancel</button>
          <button type="button" disabled={busy || !selected} onClick={() => void send()} className={buttonStyle}>Send to TV</button>
        </div>
      </dialog>
    </section>
  );
}
