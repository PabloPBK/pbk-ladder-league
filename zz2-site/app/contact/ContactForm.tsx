"use client";

import { useState, type FormEvent } from "react";
import { contactLimits, contactTopics } from "../../lib/contact";

const field = "mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[#081b3b] [color-scheme:light] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1350b6]";

export function ContactForm({ endpoint }: { endpoint: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setState("sending");
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok || result.sent !== true) throw new Error(result.error || "We couldn’t send your message. Please try again.");
      form.reset();
      setState("sent");
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "Error" ? failure.message : "We couldn’t send your message. Please try again.");
      setState("idle");
    }
  }

  return (
    <form method="post" onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 text-[#081b3b] shadow-sm sm:p-8">
      <h2 className="text-2xl font-extrabold">Send us a message</h2>
      <noscript><p className="mt-4 text-sm text-slate-700">Enable JavaScript to use the form, or email ZZ2 directly.</p></noscript>
      <fieldset disabled={state === "sending"} className="mt-5 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Name
            <input name="name" autoComplete="name" required maxLength={contactLimits.name} className={field} />
          </label>
          <label className="block text-sm font-semibold">Email
            <input name="email" type="email" autoComplete="email" required maxLength={contactLimits.email} className={field} />
          </label>
        </div>
        <label className="block text-sm font-semibold">Topic
          <select name="topic" required defaultValue="" className={field}>
            <option value="" disabled>Choose a topic</option>
            {contactTopics.map((topic) => <option key={topic}>{topic}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Message
          <textarea name="message" required rows={6} maxLength={contactLimits.message} className={field} />
        </label>
        <div hidden>
          <label>Leave this field blank<input name="website" autoComplete="off" tabIndex={-1} /></label>
        </div>
        <button type="submit" className="min-h-12 rounded-md bg-[#ffd22e] px-6 py-3 text-sm font-bold text-[#06152e] hover:bg-yellow-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1350b6] disabled:opacity-60">
          {state === "sending" ? "Sending…" : "Send message"}
        </button>
      </fieldset>
      {state === "sent" && <p className="mt-4 text-sm font-semibold text-green-800" role="status">Thanks for reaching out. ZZ2 received your message.</p>}
      {error && <p className="mt-4 text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </form>
  );
}
