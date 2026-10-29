
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePB101MembershipDecision } from "./conversion-actions";

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  membership_decision: string | null;
  conversion_reason: string | null;
  conversion_notes: string | null;
  follow_up_date: string | null;
  trial_end_date: string;
};

type Props = {
  guests: Guest[];
};

const REASONS = [
  { value: "community", label: "Community / Social Experience" },
  { value: "coaching", label: "Coaching / Learning" },
  { value: "fitness", label: "Fitness / Exercise" },
  { value: "competition", label: "Competition" },
  { value: "schedule", label: "Schedule / Availability" },
  { value: "pricing", label: "Membership Pricing" },
  { value: "location", label: "Location / Travel" },
  { value: "not_ready", label: "Not Ready to Commit" },
  { value: "other", label: "Other" },
] as const;

type Decision = "converted" | "declined" | "considering";

export default function MembershipDecisionForm({
  guests,
}: Props) {
  const router = useRouter();

  const [guestId, setGuestId] = useState("");
  const [decision, setDecision] =
    useState<Decision>("considering");
  const [reason, setReason] = useState("not_ready");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function selectGuest(id: string) {
    setGuestId(id);
    setMessage("");

    const guest = guests.find((item) => item.id === id);

    if (!guest) {
      setDecision("considering");
      setReason("not_ready");
      setNotes("");
      setFollowUpDate("");
      return;
    }

    const savedDecision = guest.membership_decision;

    setDecision(
      savedDecision === "converted" ||
        savedDecision === "declined" ||
        savedDecision === "considering"
        ? savedDecision
        : "considering"
    );

    setReason(guest.conversion_reason || "not_ready");
    setNotes(guest.conversion_notes || "");
    setFollowUpDate(guest.follow_up_date || "");
  }

  async function handleSave(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!guestId) {
      setMessage("Please select a guest.");
      setIsError(true);
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const result = await savePB101MembershipDecision({
        guestId,
        decision,
        reason: reason as
          | "community"
          | "coaching"
          | "fitness"
          | "competition"
          | "schedule"
          | "pricing"
          | "location"
          | "not_ready"
          | "other",
        notes,
        followUpDate: followUpDate || null,
      });

      setMessage(result.message);
      setIsError(!result.success);

      if (result.success) {
        router.refresh();
      }
    } catch {
      setMessage("Unable to save. Please try again.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  const selectedGuest = guests.find(
    (guest) => guest.id === guestId
  );

  return (
    <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-xl font-black text-yellow-400">
          Membership Conversion Tracking
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Record membership decisions, guest feedback,
          and follow-up dates after the PB101+ experience.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label
            htmlFor="membership-guest"
            className="mb-2 block text-sm font-semibold text-white"
          >
            Select Guest
          </label>
          <select
            id="membership-guest"
            value={guestId}
            onChange={(event) =>
              selectGuest(event.target.value)
            }
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-white"
          >
            <option value="">Choose a PB101+ guest</option>
            {guests.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.first_name} {guest.last_name} —{" "}
                {guest.email}
              </option>
            ))}
          </select>
        </div>

        {selectedGuest && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-sm text-zinc-300">
            <p>
              <strong>Trial ends:</strong>{" "}
              {selectedGuest.trial_end_date}
            </p>
            <p className="mt-1">
              <strong>Trial status:</strong>{" "}
              {selectedGuest.status}
            </p>
            <p className="mt-1">
              <strong>Recorded decision:</strong>{" "}
              {selectedGuest.membership_decision ||
                "No decision recorded"}
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="membership-decision"
            className="mb-2 block text-sm font-semibold text-white"
          >
            Membership Decision
          </label>
          <select
            id="membership-decision"
            value={decision}
            onChange={(event) =>
              setDecision(event.target.value as Decision)
            }
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-white"
          >
            <option value="considering">
              Still Considering Membership
            </option>
            <option value="converted">
              Became a Member
            </option>
            <option value="declined">
              Declined Membership
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="membership-reason"
            className="mb-2 block text-sm font-semibold text-white"
          >
            Primary Reason
          </label>
          <select
            id="membership-reason"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-white"
          >
            {REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="membership-notes"
            className="mb-2 block text-sm font-semibold text-white"
          >
            Guest Feedback / Staff Notes
          </label>
          <textarea
            id="membership-notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            rows={4}
            maxLength={2000}
            placeholder="What did the guest say about their experience or membership decision?"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-white"
          />
        </div>

        <div>
          <label
            htmlFor="membership-follow-up"
            className="mb-2 block text-sm font-semibold text-white"
          >
            Follow-Up Date (Optional)
          </label>
          <input
            id="membership-follow-up"
            type="date"
            value={followUpDate}
            onChange={(event) =>
              setFollowUpDate(event.target.value)
            }
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-white"
          />
        </div>

        {message && (
          <div
            role="status"
            className={`rounded-xl p-3 text-sm ${
              isError
                ? "bg-red-950 text-red-300"
                : "bg-green-950 text-green-300"
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !guestId}
          className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving Membership Decision..."
            : "Save Membership Decision"}
        </button>
      </form>
    </section>
  );
}
