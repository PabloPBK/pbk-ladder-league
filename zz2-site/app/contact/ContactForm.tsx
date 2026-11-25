"use client";

import { useState, type FormEvent } from "react";
import { contactDraftUrl, contactLimits, contactTopics } from "../../lib/contact";

const field = "mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[#081b3b] [color-scheme:light] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1350b6]";

export function ContactForm({ email }: { email: string }) {
  const [draftOpened, setDraftOpened] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraftOpened(false);
    setError("");
    try {
      const inquiry = Object.fromEntries(new FormData(event.currentTarget));
      window.location.href = contactDraftUrl(email, inquiry);
      setDraftOpened(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t open an email draft. Use the direct email link.");
    }
  }

  return (
    <form method="post" onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 text-[#081b3b] shadow-sm sm:p-8">
      <h2 className="text-2xl font-extrabold">Write to ZZ2</h2>
      <p className="mt-2 text-sm text-slate-700">This form opens a draft in your email app. Send it from there.</p>
      <noscript><p className="mt-4 text-sm text-slate-700">Enable JavaScript to use the form, or email ZZ2 directly.</p></noscript>
      <fieldset className="mt-5 space-y-5">
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
        <button type="submit" className="min-h-12 rounded-md bg-[#ffd22e] px-6 py-3 text-sm font-bold text-[#06152e] hover:bg-yellow-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1350b6] disabled:opacity-60">
          Open email draft
        </button>
      </fieldset>
      {draftOpened && <p className="mt-4 text-sm text-slate-700" role="status">If your email app opened, send the draft there. You can also use the direct email link.</p>}
      {error && <p className="mt-4 text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </form>
  );
}
