"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  { name: "first_name", label: "First name", type: "text", autoComplete: "given-name" },
  { name: "last_name", label: "Last name", type: "text", autoComplete: "family-name" },
  { name: "pb101_completed_at", label: "PB101 class completion date", type: "date" },
  { name: "trial_start_date", label: "Trial start date", type: "date" },
] as const;

export function GuestEditForm({ guest }: { guest: GuestDetails }) {
  const [values, setValues] = useState(guest);
  const [message, formAction, pending] = useActionState(
    editPB101Guest.bind(null, guest.id, guest.updated_at),
    ""
  );

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className="block text-sm font-semibold text-zinc-300">
            {field.label}
            <input
              name={field.name}
              type={field.type}
              value={values[field.name]}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              required
              disabled={pending}
              maxLength={field.type === "text" ? 100 : undefined}
              autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
              className="mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400"
            />
          </label>
        ))}
      </div>

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
