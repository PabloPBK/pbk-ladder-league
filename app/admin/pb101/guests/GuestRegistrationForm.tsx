
"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  registerPB101Guest,
  type GuestRegistrationState,
} from "./actions";

const initialState: GuestRegistrationState = {
  success: false,
  message: "",
};

const coaches = ["Zack", "Other"];

export function GuestRegistrationForm() {
  const [state, formAction, isPending] = useActionState(
    registerPB101Guest,
    initialState
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-yellow-400">
          Register New PB101+ Guest
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Register guests after completing their introductory
          PB101 class. Their seven-day trial starts on the
          completion date.
        </p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="first_name"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              First Name *
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              maxLength={100}
              autoComplete="given-name"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              placeholder="First name"
            />
          </div>

          <div>
            <label
              htmlFor="last_name"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Last Name *
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              maxLength={100}
              autoComplete="family-name"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              placeholder="Last name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Email Address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              placeholder="guest@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              maxLength={30}
              autoComplete="tel"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              placeholder="(555) 555-5555"
            />
          </div>

          <div>
            <label
              htmlFor="coach_name"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              PB101 Coach
            </label>
            <select
              id="coach_name"
              name="coach_name"
              defaultValue=""
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option value="">Select a coach</option>
              {coaches.map((coach) => (
                <option key={coach} value={coach}>
                  {coach}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pb101_completed_at"
              className="mb-2 block text-sm font-semibold text-zinc-300"
            >
              PB101 Completion Date *
            </label>
            <input
              id="pb101_completed_at"
              name="pb101_completed_at"
              type="date"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="coach_notes"
            className="mb-2 block text-sm font-semibold text-zinc-300"
          >
            Coach Notes (Optional)
          </label>
          <textarea
            id="coach_notes"
            name="coach_notes"
            rows={3}
            maxLength={2000}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            placeholder="Interests, goals, or helpful notes for follow-up..."
          />
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <label
            htmlFor="email_consent"
            className="flex cursor-pointer items-start gap-3"
          >
            <input
              id="email_consent"
              name="email_consent"
              type="checkbox"
              value="yes"
              className="mt-1 h-5 w-5 shrink-0 accent-yellow-400"
            />
            <span>
              <span className="block text-sm font-semibold text-white">
                Guest agreed to receive PB101+ emails
              </span>
              <span className="mt-1 block text-sm text-zinc-400">
                Check this only after the guest has agreed
                to receive the five PB101+ follow-up emails:
                Welcome, Day 2, Day 4, Day 6, and Day 9.
                Leave unchecked if consent was not given.
              </span>
            </span>
          </label>
        </div>

        {state.message && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-xl border p-3 text-sm ${
              state.success
                ? "border-green-800 bg-green-950/30 text-green-300"
                : "border-red-800 bg-red-950/30 text-red-300"
            }`}
          >
            {state.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Registering..." : "Register Guest"}
        </button>
      </form>
    </section>
  );
}
