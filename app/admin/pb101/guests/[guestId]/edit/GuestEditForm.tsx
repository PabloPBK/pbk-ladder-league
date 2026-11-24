"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PB101_DATE_INPUT_HINT } from "../../date-input";
import { editPB101Guest } from "./actions";

type GuestDetails = {
  id: string;
  first_name: string;
  last_name: string;
  pb101_completed_at: string;
  trial_start_date: string;
  updated_at: string;
};

const fields = [
  { name: "first_name", label: "First name", autoComplete: "given-name" },
  { name: "last_name", label: "Last name", autoComplete: "family-name" },
  { name: "pb101_completed_at", label: "PB101 class completion date" },
  { name: "trial_start_date", label: "Trial start date" },
] as const;

function displayDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${year}`;
}

export function GuestEditForm({ guest }: { guest: GuestDetails }) {
  const [values, setValues] = useState({
    first_name: guest.first_name,
    last_name: guest.last_name,
    pb101_completed_at: displayDate(guest.pb101_completed_at),
    trial_start_date: displayDate(guest.trial_start_date),
  });
  const [message, formAction, pending] = useActionState(
    editPB101Guest.bind(null, guest.id, guest.updated_at),
    ""
  );

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const isDate = field.name === "pb101_completed_at" || field.name === "trial_start_date";

          return (
            <label key={field.name} className="block text-sm font-semibold text-zinc-300">
              {field.label}
              <input
                name={field.name}
                type="text"
                value={values[field.name]}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                required
                disabled={pending}
                maxLength={isDate ? undefined : 100}
                inputMode={isDate ? "numeric" : undefined}
                placeholder={isDate ? "MM/DD/YYYY" : undefined}
                aria-describedby={isDate ? "pb101-date-format" : undefined}
                autoComplete={"autoComplete" in field ? field.autoComplete : "off"}
                className="mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400"
              />
            </label>
          );
        })}
      </div>

      <p id="pb101-date-format" className="text-sm text-zinc-400">
        {PB101_DATE_INPUT_HINT}
      </p>

      <p className="text-sm text-zinc-400">
        Changing the trial start date adjusts the seven-day trial end date and any pending follow-up emails.
      </p>

      {message && <p role="alert" className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">{message}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-500 disabled:opacity-50">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link href={`/admin/pb101/guests#guest-${guest.id}`} className="text-sm text-zinc-300 underline underline-offset-4">
          Cancel
        </Link>
      </div>
    </form>
  );
}
