"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LeagueRegistrationSession } from "@/zz2-site/lib/league-contract";
import {
  listingStatuses, registrationLabels, registrationStatuses, resultOptions,
  type LeagueListing, type ListingFacility,
} from "@/lib/data/league-listings";

const control = "w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2.5 text-white focus-visible:outline-2 focus-visible:outline-yellow-400";
const sessionFields = [
  ["date", "Date", "date"],
  ["start_time", "Starts", "time"],
  ["end_time", "Ends", "time"],
  ["url", "Registration link", "url"],
] as const;

export default function LeagueListingForm({
  listing, facilities, leagues, seasons,
}: {
  listing?: LeagueListing;
  facilities: ListingFacility[];
  leagues: { id: string; name: string }[];
  seasons: { id: string; league_id: string; name: string }[];
}) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState(listing?.league_id ?? "");
  const [seasonId, setSeasonId] = useState(listing?.season_id ?? "");
  const [sessions, setSessions] = useState(() =>
    (listing?.registration_sessions ?? []).map((session, key) => ({ ...session, key }))
  );
  const nextSessionKey = useRef(sessions.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const flags = Object.fromEntries(["dupr_rated", ...resultOptions.map(([key]) => key)]
      .map((key) => [key, form.has(key)]));
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/league-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload, ...flags,
          registration_sessions: sessions.map(({ date, start_time, end_time, url }) => ({ date, start_time, end_time, url })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save league.");
      setMessage(body.listing.status === "published" ? "Published to ZZ2 and the facility’s Leagues page." : "League listing saved.");
      if (!listing) router.replace("/admin/events/leagues?edit=" + body.listing.id);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save league.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="space-y-5 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 sm:p-6" onSubmit={submit}>
      <h2 className="text-xl font-bold">{listing ? "Edit league listing" : "Create league listing"}</h2>
      {listing && <><input type="hidden" name="id" value={listing.id} /><input type="hidden" name="updated_at" value={listing.updated_at} /></>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">League name<input name="name" required maxLength={180} defaultValue={listing?.name} className={control} /></label>
        <label className="grid gap-1.5 text-sm">Facility
          <select name="facility_id" required className={control} defaultValue={listing?.facility_id ?? ""}>
            <option value="">Choose a facility</option>
            {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">Start date<input name="start_date" type="date" required defaultValue={listing?.start_date} className={control} /></label>
        <label className="grid gap-1.5 text-sm">End date<input name="end_date" type="date" required defaultValue={listing?.end_date} className={control} /></label>
        <label className="grid gap-1.5 text-sm">Format<input name="format" maxLength={180} defaultValue={listing?.format ?? ""} className={control} /></label>
        <label className="grid gap-1.5 text-sm">Skill level<input name="skill_level" maxLength={100} defaultValue={listing?.skill_level ?? ""} className={control} /></label>
        <label className="grid gap-1.5 text-sm">Pricing<input name="pricing" maxLength={100} defaultValue={listing?.pricing ?? ""} className={control} /></label>
        <label className="grid gap-1.5 text-sm">Registration status
          <select name="registration_status" className={control} defaultValue={listing?.registration_status ?? "open"}>
            {registrationStatuses.map((status) => <option key={status} value={status}>{registrationLabels[status]}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">Registration URL<input name="registration_url" type="url" maxLength={2048} defaultValue={listing?.registration_url ?? ""} className={control} /></label>
        <label className="grid gap-1.5 text-sm">League logo URL<input name="logo_url" type="url" maxLength={2048} defaultValue={listing?.logo_url ?? ""} className={control} /></label>
      </div>
      <label className="grid gap-1.5 text-sm">Description<textarea name="description" rows={4} maxLength={6000} defaultValue={listing?.description ?? ""} className={control} /></label>
      <label className="flex items-center gap-2 text-sm"><input name="dupr_rated" type="checkbox" defaultChecked={listing?.dupr_rated} />DUPR-rated league</label>
      <fieldset className="space-y-3 rounded-xl border border-zinc-700 p-4">
        <legend className="px-2 font-semibold">Drop-in registration</legend>
        <p className="text-sm text-zinc-400">Add each session with its local times and registration link.</p>
        {sessions.map((session, index) => (
          <div key={session.key} className="grid items-end gap-3 rounded-lg border border-zinc-700 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]">
            {sessionFields.map(([field, label, type]) => (
              <label key={field} className="grid gap-1.5 text-sm">
                {label}
                <input type={type} required className={control} value={session[field]}
                  aria-label={`Session ${index + 1} ${label.toLowerCase()}`}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSessions((rows) => rows.map((row) => row.key === session.key ? { ...row, [field]: value } : row));
                  }} />
              </label>
            ))}
            <button type="button" aria-label={`Remove session ${index + 1}`} className="min-h-10 text-sm text-red-300 underline"
              onClick={() => setSessions((rows) => rows.filter((row) => row.key !== session.key))}>Remove</button>
          </div>
        ))}
        <button type="button" disabled={sessions.length >= 40} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={() => {
            const session: LeagueRegistrationSession & { key: number } = {
              key: nextSessionKey.current++, date: "", start_time: "", end_time: "", url: "",
            };
            setSessions((rows) => [...rows, session]);
          }}>Add session</button>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-zinc-700 p-4">
        <legend className="px-2 font-semibold">Public results</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">Operations league
            <select name="league_id" className={control} value={leagueId} onChange={(event) => {
              setLeagueId(event.target.value);
              setSeasonId("");
            }}>
              <option value="">No operations league</option>
              {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">Season
            <select name="season_id" className={control} value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
              <option value="">No season linked</option>
              {seasons.filter((season) => season.league_id === leagueId).map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
            </select>
          </label>
        </div>
        <p className="text-sm text-zinc-400">Link an existing season to show results as league nights are completed.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {resultOptions.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input name={key} type="checkbox" disabled={!seasonId} defaultChecked={listing?.[key]} />{label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1.5 text-sm">Listing status
          <select name="status" className={control} defaultValue={listing?.status ?? "draft"}>
            {listingStatuses.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
          </select>
        </label>
        <button type="submit" disabled={saving} className="rounded-lg bg-yellow-400 px-5 py-2.5 font-bold text-zinc-950 hover:bg-yellow-300 disabled:opacity-60">
          {saving ? "Saving…" : "Save league"}
        </button>
      </div>
      <p className="text-sm text-zinc-400">Published listings appear on ZZ2 and the selected facility’s public page automatically.</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-green-300">{message}</p>}
    </form>
  );
}
