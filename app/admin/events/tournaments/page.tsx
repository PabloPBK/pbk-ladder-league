"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Tournament = {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  tournament_facilities: { name: string; city: string | null; state: string | null } | null;
};

export default function TournamentManagementPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/tournaments", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load tournaments.");
        return body.tournaments as Tournament[];
      })
      .then((rows) => { if (active) setTournaments(rows); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load tournaments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
  const groups = useMemo(() => ({
    drafts: tournaments.filter((t) => t.status === "draft"),
    upcoming: tournaments.filter((t) => t.status !== "draft" && t.end_date >= today),
    published: tournaments.filter((t) => t.status === "published"),
    past: tournaments.filter((t) => t.status !== "draft" && t.end_date < today),
  }), [tournaments, today]);
  const sections = [
    { title: "Draft Tournaments", rows: groups.drafts, empty: "No drafts yet." },
    { title: "Upcoming Tournaments", rows: groups.upcoming, empty: "No upcoming tournaments." },
    { title: "Past Tournaments", rows: groups.past, empty: "No past tournaments." },
  ];
  return (
    <AppLayout title="Tournament Management" description="Create and manage tournaments across multiple facilities.">
      <div className="space-y-6">
        <Link href="/admin/events" className="inline-block text-sm font-semibold text-yellow-400 hover:underline">← Back to Event Types</Link>
        <section className="rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">PBK NORTHWEST · ZZ2 PICKLEBALL</p>
          <h2 className="mt-3 text-3xl font-black text-white">Tournament Management</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Create tournaments, manage multiple facilities, and publish events to ZZ2 Pickleball and PBK Northwest.</p>
          <Link href="/admin/events/tournaments/new" className="mt-5 inline-flex rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-yellow-300">+ Create Tournament</Link>
        </section>
        {error && <p role="alert" className="rounded-xl border border-red-500/40 p-4 text-red-300">{error}</p>}
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Draft Tournaments", value: groups.drafts.length },
            { label: "Upcoming Tournaments", value: groups.upcoming.length },
            { label: "Published Tournaments", value: groups.published.length },
            { label: "Past Tournaments", value: groups.past.length },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-400">{item.label}</p>
              <p className="mt-2 text-3xl font-black text-white">{loading ? "…" : error ? "—" : item.value}</p>
            </div>
          ))}
        </section>
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
            <h3 className="text-lg font-bold text-white">{section.title}</h3>
            {loading ? <p className="mt-2 text-sm text-zinc-400">Loading tournaments…</p> :
              !error && section.rows.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{section.empty}</p> :
              <div className="mt-4 space-y-3">{section.rows.map((t) => (
                <div key={t.id} className="rounded-lg border border-zinc-700 bg-zinc-950 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-white">{t.name}</p>
                    <span className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold uppercase text-zinc-300">{t.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{t.tournament_facilities?.name ?? "Facility not assigned"} · {t.start_date}{t.end_date !== t.start_date ? " – " + t.end_date : ""}</p>
                </div>
              ))}</div>}
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
