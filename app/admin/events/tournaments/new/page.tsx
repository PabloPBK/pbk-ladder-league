
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";

type Facility = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

export default function CreateTournamentPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [facilityError, setFacilityError] = useState("");

  const [name, setName] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [registrationPlatform, setRegistrationPlatform] =
    useState("PodPlay");
  const [registrationUrl, setRegistrationUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedTournamentId, setSavedTournamentId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFacilities() {
      setLoadingFacilities(true);
      setFacilityError("");

      const { data, error } = await supabase
        .from("tournament_facilities")
        .select("id, name, city, state")
        .order("name");

      if (!active) return;

      if (error) {
        console.error("Unable to load facilities:", error);
        setFacilityError(
          "Unable to load facilities. Check your staff access."
        );
      } else {
        setFacilities(data ?? []);
      }

      setLoadingFacilities(false);
    }

    loadFacilities();

    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || savedTournamentId) return;

    setSaving(true);
    setSaveError("");

    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          facility_id: facilityId,
          start_date: startDate,
          end_date: endDate,
          description: description.trim(),
          registration_platform: registrationPlatform,
          registration_url: registrationUrl.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save tournament."
        );
      }

      setSavedTournamentId(result.tournament.id);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400";

  const labelClass =
    "mb-2 block text-sm font-semibold text-zinc-300";

  return (
    <AppLayout
      title="Create Tournament"
      description="Create a new tournament and save it as a draft."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/events/tournaments"
          className="text-sm font-semibold text-yellow-400 hover:underline"
        >
          ← Back to Tournament Management
        </Link>

        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
            Tournament Management
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Create a New Tournament
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Enter the tournament details below. Saving creates
            a private draft and does not publish the tournament.
          </p>
        </section>

        {savedTournamentId ? (
          <section className="space-y-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6">
            <h3 className="text-xl font-bold text-emerald-300">
              Tournament Saved Successfully!
            </h3>

            <p className="text-sm text-zinc-300">
              Your tournament has been saved as a draft
              in Supabase.
            </p>

            <p className="break-all text-xs text-zinc-400">
              Tournament ID: {savedTournamentId}
            </p>

            <Link
              href="/admin/events/tournaments"
              className="inline-flex rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-yellow-300"
            >
              Return to Tournament Management
            </Link>
          </section>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <section className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
              <h3 className="text-lg font-bold text-white">
                Tournament Details
              </h3>

              <div>
                <label
                  htmlFor="tournament-name"
                  className={labelClass}
                >
                  Tournament Name *
                </label>

                <input
                  id="tournament-name"
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  className={inputClass}
                  placeholder="Example: ZZ2 Winter Classic"
                />
              </div>

              <div>
                <label
                  htmlFor="facility"
                  className={labelClass}
                >
                  Host Facility *
                </label>

                <select
                  id="facility"
                  required
                  value={facilityId}
                  onChange={(event) =>
                    setFacilityId(event.target.value)
                  }
                  disabled={loadingFacilities}
                  className={inputClass}
                >
                  <option value="">
                    {loadingFacilities
                      ? "Loading facilities..."
                      : "Select facility"}
                  </option>

                  {facilities.map((facility) => (
                    <option
                      key={facility.id}
                      value={facility.id}
                    >
                      {facility.name}
                      {facility.city
                        ? ` — ${facility.city}, ${facility.state ?? ""}`
                        : ""}
                    </option>
                  ))}
                </select>

                {facilityError && (
                  <p className="mt-2 text-sm text-red-400">
                    {facilityError}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="start-date"
                    className={labelClass}
                  >
                    Start Date *
                  </label>

                  <input
                    id="start-date"
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => {
                      const nextStart = event.target.value;

                      setStartDate(nextStart);

                      if (
                        endDate &&
                        endDate < nextStart
                      ) {
                        setEndDate("");
                      }
                    }}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="end-date"
                    className={labelClass}
                  >
                    End Date *
                  </label>

                  <input
                    id="end-date"
                    type="date"
                    required
                    min={startDate || undefined}
                    value={endDate}
                    onChange={(event) =>
                      setEndDate(event.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className={labelClass}
                >
                  Tournament Description
                </label>

                <textarea
                  id="description"
                  rows={5}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  className={inputClass}
                  placeholder="Tournament format, divisions, and important information..."
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
              <h3 className="text-lg font-bold text-white">
                Registration Information
              </h3>

              <div>
                <label
                  htmlFor="registration-platform"
                  className={labelClass}
                >
                  Registration Platform
                </label>

                <select
                  id="registration-platform"
                  value={registrationPlatform}
                  onChange={(event) =>
                    setRegistrationPlatform(event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="PodPlay">
                    PodPlay
                  </option>

                  <option value="PickleballBrackets">
                    PickleballBrackets
                  </option>

                  <option value="Other">
                    Other Website
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="registration-url"
                  className={labelClass}
                >
                  Registration URL
                </label>

                <input
                  id="registration-url"
                  type="url"
                  value={registrationUrl}
                  onChange={(event) =>
                    setRegistrationUrl(event.target.value)
                  }
                  className={inputClass}
                  placeholder="https://..."
                />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
              <h3 className="text-lg font-bold text-white">
                Publishing Status
              </h3>

              <p className="text-sm text-zinc-300">
                New tournaments are saved as drafts.
              </p>

              <p className="text-xs text-zinc-500">
                Publishing to ZZ2 Pickleball and PBK Northwest
                will be configured in a later step.
              </p>
            </section>

            {saveError && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300"
              >
                {saveError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={
                  saving ||
                  loadingFacilities ||
                  facilities.length === 0
                }
                className="rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Draft"}
              </button>

              <Link
                href="/admin/events/tournaments"
                className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
