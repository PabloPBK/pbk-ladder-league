
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Facility = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

type Organizer = {
  id: string;
  name: string;
};

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400";

const labelClass =
  "mb-2 block text-sm font-semibold text-zinc-300";

export default function CreateTournamentPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [facilityError, setFacilityError] = useState("");

  const [facilityId, setFacilityId] = useState("");
  const [showNewFacility, setShowNewFacility] = useState(false);

  const [newFacilityName, setNewFacilityName] = useState("");
  const [newFacilityAddress, setNewFacilityAddress] = useState("");
  const [newFacilityCity, setNewFacilityCity] = useState("");
  const [newFacilityState, setNewFacilityState] = useState("WA");
  const [newFacilityWebsite, setNewFacilityWebsite] = useState("");

  const [addingFacility, setAddingFacility] = useState(false);
  const [addFacilityError, setAddFacilityError] = useState("");

  const [name, setName] = useState("");
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

      try {
        const response = await fetch(
          "/api/tournament-facilities",
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load facilities."
          );
        }

        if (active) {
          setFacilities(result.facilities ?? []);
        }
      } catch (error) {
        if (active) {
          setFacilityError(
            error instanceof Error
              ? error.message
              : "Unable to load facilities."
          );
        }
      } finally {
        if (active) setLoadingFacilities(false);
      }
    }

    loadFacilities();

    return () => {
      active = false;
    };
  }, []);

  async function handleAddFacility(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (addingFacility) return;

    setAddingFacility(true);
    setAddFacilityError("");

    try {
      const response = await fetch(
        "/api/tournament-facilities",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            name: newFacilityName.trim(),
            address: newFacilityAddress.trim(),
            city: newFacilityCity.trim(),
            state: newFacilityState.trim(),
            website_url: newFacilityWebsite.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to add facility."
        );
      }

      const facility: Facility = result.facility;

      setFacilities((previous) =>
        [...previous, facility].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setFacilityId(facility.id);
      setShowNewFacility(false);

      setNewFacilityName("");
      setNewFacilityAddress("");
      setNewFacilityCity("");
      setNewFacilityState("WA");
      setNewFacilityWebsite("");
    } catch (error) {
      setAddFacilityError(
        error instanceof Error
          ? error.message
          : "Unable to add facility."
      );
    } finally {
      setAddingFacility(false);
    }
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
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
          : "Unable to save tournament."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedFacility = facilities.find(
    (facility) => facility.id === facilityId
  );

  const facilityName = selectedFacility?.name ?? "";

  const destination =
    facilityName === "Pickleball Kingdom Lynnwood"
      ? "ZZ2 Pickleball + PBK Lynnwood"
      : facilityName === "Pickleball Kingdom Poulsbo"
      ? "ZZ2 Pickleball + PBK Poulsbo"
      : "ZZ2 Pickleball";

  return (
    <AppLayout
      title="Create Tournament"
      description="Create tournaments for PBK and ZZ2 partner locations."
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
            ZZ2 PICKLEBALL · TOURNAMENT MANAGEMENT
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Create a New Tournament
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Create a tournament at any PBK or partner facility.
            The location determines its future website destinations.
          </p>
        </section>

        {savedTournamentId ? (
          <section className="space-y-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6">
            <h3 className="text-xl font-bold text-emerald-300">
              Tournament Saved Successfully!
            </h3>

            <p className="text-sm text-zinc-300">
              Your tournament is saved as a private draft.
              It has not been published.
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
          <>
            <section className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
              <h3 className="text-lg font-bold text-white">
                Tournament Location
              </h3>

              <div>
                <label
                  htmlFor="facility"
                  className={labelClass}
                >
                  Host Facility *
                </label>

                <select
                  id="facility"
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
                      : "Select a facility"}
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

              <button
                type="button"
                onClick={() =>
                  setShowNewFacility((previous) => !previous)
                }
                className="text-sm font-bold text-yellow-400 hover:underline"
              >
                {showNewFacility
                  ? "− Close New Facility"
                  : "+ Add New Facility / Partner Location"}
              </button>

              {showNewFacility && (
                <form
                  onSubmit={handleAddFacility}
                  className="space-y-4 rounded-xl border border-yellow-500/30 bg-zinc-950 p-5"
                >
                  <h4 className="font-bold text-white">
                    Add Partner Facility
                  </h4>

                  <div>
                    <label
                      htmlFor="new-facility-name"
                      className={labelClass}
                    >
                      Facility Name *
                    </label>

                    <input
                      id="new-facility-name"
                      required
                      maxLength={200}
                      value={newFacilityName}
                      onChange={(event) =>
                        setNewFacilityName(event.target.value)
                      }
                      className={inputClass}
                      placeholder="Example: Seattle Pickleball Center"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-facility-address"
                      className={labelClass}
                    >
                      Street Address
                    </label>

                    <input
                      id="new-facility-address"
                      value={newFacilityAddress}
                      onChange={(event) =>
                        setNewFacilityAddress(event.target.value)
                      }
                      className={inputClass}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="new-facility-city"
                        className={labelClass}
                      >
                        City *
                      </label>

                      <input
                        id="new-facility-city"
                        required
                        value={newFacilityCity}
                        onChange={(event) =>
                          setNewFacilityCity(event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-facility-state"
                        className={labelClass}
                      >
                        State *
                      </label>

                      <input
                        id="new-facility-state"
                        required
                        value={newFacilityState}
                        onChange={(event) =>
                          setNewFacilityState(event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="new-facility-website"
                      className={labelClass}
                    >
                      Facility Website (Optional)
                    </label>

                    <input
                      id="new-facility-website"
                      type="url"
                      value={newFacilityWebsite}
                      onChange={(event) =>
                        setNewFacilityWebsite(event.target.value)
                      }
                      className={inputClass}
                      placeholder="https://..."
                    />
                  </div>

                  {addFacilityError && (
                    <p
                      role="alert"
                      className="text-sm text-red-400"
                    >
                      {addFacilityError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={addingFacility}
                    className="rounded-lg bg-yellow-400 px-5 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
                  >
                    {addingFacility
                      ? "Adding Facility..."
                      : "Save New Facility"}
                  </button>
                </form>
              )}

              {facilityId && (
                <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Automatic Website Destinations
                  </p>

                  <p className="mt-2 text-sm font-semibold text-yellow-400">
                    {destination}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    Destinations are assigned automatically.
                    Your tournament will remain private until published.
                  </p>
                </div>
              )}
            </section>

            <form
              onSubmit={handleSave}
              className="space-y-6"
            >
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

                        if (endDate && endDate < nextStart) {
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
                    <option value="PodPlay">PodPlay</option>
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
                    !facilityId
                  }
                  className="rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>

                <Link
                  href="/admin/events/tournaments"
                  className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </AppLayout>
  );
}
