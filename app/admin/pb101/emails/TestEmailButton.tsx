
"use client";

import { useState } from "react";

export default function TestEmailButton() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function sendTestEmail() {
    if (sending) return;

    setSending(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/pb101/email/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to send test email."
        );
      }

      setSuccess(true);
      setMessage(
        "Test email sent successfully! Check your inbox."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <p className="text-sm text-zinc-400">
        Send a test message to
        {" "}pablo@pickleballkingdomlynnwood.com.
        No guests will receive this email.
      </p>

      <button
        type="button"
        onClick={sendTestEmail}
        disabled={sending}
        className="rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send Test Email"}
      </button>

      {message && (
        <p
          role="status"
          className={
            success
              ? "text-sm font-semibold text-green-400"
              : "text-sm font-semibold text-red-400"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
