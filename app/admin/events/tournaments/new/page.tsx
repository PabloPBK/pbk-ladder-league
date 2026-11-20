
"use client";

import { useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

export default function CreateTournamentPage() {
  const [name, setName] = useState("");
  const [facility, setFacility] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [registrationPlatform, setRegistrationPlatform] =
    useState("PodPlay");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [publishZZ2, setPublishZZ2] = useState(true);
  const [publishPBK, setPublishPBK] = useState(true);

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400";

  const labelClass = "mb-2 block text-sm font-semibold text-zinc-300";

  return (
    <AppLayout
      title="Create Tournament"
      description="Enter tournament details and choose publication destinations."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/events/tournaments"
          className="text-sm font-semibold text-yellow-400 hover:underline"
        >
          ← Back to Tournament Management
        </Link>

        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
          <h2 className="text-2xl font-black text-white">
            Create a New Tournament
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Complete the information below to prepare your tournament.
          </p>
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            window.alert(
              "Tournament form preview complete. Database saving will be added next."
            );
          }}
          className="space-y-6"
        >
          <section className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
            <h3 className="text-lg font-bold text-white">
              Tournament Details
            </h3>

            <div>
              <label className={labelClass}>Tournament Name *</label>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                placeholder="Example: ZZ2 Winter Classic"
              />
            </div>

            <div>
              <label className={labelClass}>Host Facility *</label>
              <select
                required
                value={facility}
                onChange={(event) => setFacility(event.target.value)}
                className={inputClass}
              >
                <option value="">Select facility</option>
                <option value="PBK Lynnwood">PBK Lynnwood</option>
                <option value="PBK Poulsbo">PBK Poulsbo</option>
                <option value="Other">Other / Partner Facility</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Start Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End Date *</label>
                <input
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Tournament Description</label>
              <textarea
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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
              <label className={labelClass}>Registration Platform</label>
              <select
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
                <option value="Other">Other Website</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Registration URL</label>
              <input
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

          <section className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
            <h3 className="text-lg font-bold text-white">
              Website Publishing
            </h3>

            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={publishZZ2}
                onChange={(event) =>
                  setPublishZZ2(event.target.checked)
                }
                className="h-5 w-5 accent-yellow-400"
              />
              Publish to ZZ2 Pickleball
            </label>

            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={publishPBK}
                onChange={(event) =>
                  setPublishPBK(event.target.checked)
                }
                className="h-5 w-5 accent-yellow-400"
              />
              Publish to PBK Northwest
            </label>

            <p className="text-xs text-zinc-500">
              Website publishing will become available after
              the public websites are connected.
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-yellow-300"
            >
              Preview Tournament
            </button>

            <Link
              href="/admin/events/tournaments"
              className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
