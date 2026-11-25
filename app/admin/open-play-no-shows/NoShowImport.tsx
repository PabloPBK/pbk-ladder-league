"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { noShowFacilityName, noShowMaxFiles, noShowMaxFileSize, noShowStartDate } from "@/lib/data/open-play-no-shows";

const field = "mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white";

export function NoShowImport() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !files.length) return;
    const form = new FormData(event.currentTarget);
    files.forEach((file) => form.append("file", file));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fetch("/api/open-play-no-shows/import", { method: "POST", body: form });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Unable to import the rosters.");
      const { added, duplicates } = data as { added: number; duplicates: number };
      setMessage(
        added || duplicates
          ? `${added} added to the queue. ${duplicates} already recorded or repeated in these exports.`
          : "No Accepted players were found in these exports."
      );
      formRef.current?.reset();
      setFiles([]);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to import the rosters.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-xl font-bold">Import PodPlay rosters</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Choose up to five CSV exports from completed open plays at {noShowFacilityName}.
        Only rows with an invitation status of Accepted enter the queue.
      </p>
      <form ref={formRef} onSubmit={submit} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <div className="max-w-xl">
            <label className="block text-sm font-semibold">PodPlay CSV exports
              <input type="file" accept=".csv,text/csv" multiple className={field} onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                setMessage("");
                if (selected.length > noShowMaxFiles || selected.some((file) => !file.size || file.size > noShowMaxFileSize || !/\.csv$/i.test(file.name))) {
                  setFiles([]);
                  event.target.value = "";
                  setError("Choose up to five non-empty CSV files, each under 500 KB.");
                  return;
                }
                setFiles(selected);
                setError("");
              }} />
            </label>
          </div>
          {files.map((file, index) => (
            <fieldset key={`${file.name}-${file.lastModified}-${index}`} className="grid gap-3 rounded-lg border border-zinc-700 px-4 pb-4 pt-2 sm:grid-cols-3">
              <legend className="max-w-full break-all px-1 text-sm font-semibold">{file.name}</legend>
              <label className="block text-sm">Open-play name
                <input name="session_name" className={field} placeholder="e.g. Beginner Open Play" required maxLength={160} />
              </label>
              <label className="block text-sm">Session date
                <input name="session_date" type="date" className={field} required min={noShowStartDate} />
              </label>
              <label className="block text-sm">Start time at the facility
                <input name="session_time" type="time" className={field} required />
              </label>
            </fieldset>
          ))}
          {files.length > 0 && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="completed" value="yes" required />
            I confirmed these open plays have ended.
          </label>}
        </fieldset>
        <button type="submit" disabled={!files.length || busy} className="rounded-lg bg-blue-500 px-5 py-2.5 font-bold text-zinc-950 hover:bg-blue-400 disabled:opacity-50">
          {busy ? "Importing…" : "Import CSVs"}
        </button>
        {message && <p role="status" className="text-sm font-semibold text-green-300">{message}</p>}
        {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      </form>
    </section>
  );
}
