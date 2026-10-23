
"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const subscription = supabase.auth.onAuthStateChange(
      (event) => {
        if (!active) return;

        if (event === "PASSWORD_RECOVERY") {
          setRecoveryReady(true);
          setError("");
        }
      },
    );

    async function checkRecovery() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );

        if (url.searchParams.get("error") ||
            hashParams.get("error")) {
          setError(
            "This recovery link has expired or is invalid. Request a new one.",
          );
          return;
        }

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;

          if (active) setRecoveryReady(true);
        } else if (tokenHash && type === "recovery") {
          const { error: verifyError } =
            await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: "recovery",
            });

          if (verifyError) throw verifyError;

          if (active) setRecoveryReady(true);
        } else if (
          hashParams.has("access_token") &&
          hashParams.get("type") === "recovery"
        ) {
          const accessToken = hashParams.get("access_token")!;
          const refreshToken = hashParams.get("refresh_token");

          if (!refreshToken) {
            throw new Error("Incomplete recovery link.");
          }

          const { error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) throw sessionError;

          if (active) setRecoveryReady(true);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to verify the recovery link.",
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void checkRecovery();

    return () => {
      active = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (resetError) throw resetError;

      setMessage(
        "If this email belongs to an account, a password-reset link will be sent. Check your inbox.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send recovery email.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();

      const { error: updateError } =
        await supabase.auth.updateUser({ password });

      if (updateError) throw updateError;

      await supabase.auth.signOut();
      setComplete(true);
      setRecoveryReady(false);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-400">
          Pickleball Kingdom
        </p>

        <h1 className="mt-3 text-3xl font-black">
          {complete
            ? "Password Updated"
            : recoveryReady
              ? "Create New Password"
              : "Reset Password"}
        </h1>

        <p className="mt-2 mb-6 text-sm text-zinc-400">
          {complete
            ? "Your password has been updated. Sign in with your new password."
            : recoveryReady
              ? "Enter and confirm your new password."
              : "Enter your staff email to receive a secure reset link."}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            {message}
          </div>
        )}

        {checking ? (
          <p className="text-zinc-400">Checking recovery link...</p>
        ) : complete ? (
          <Link
            href="/login"
            className="block rounded-xl bg-blue-600 p-3 text-center font-bold"
          >
            Return to Staff Login
          </Link>
        ) : recoveryReady ? (
          <form onSubmit={savePassword} className="space-y-4">
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-blue-600 font-bold disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save New Password"}
            </button>
          </form>
        ) : (
          <form onSubmit={requestReset} className="space-y-4">
            <input
              type="email"
              autoComplete="email"
              placeholder="Staff email address"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-blue-600 font-bold disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send Reset Email"}
            </button>
          </form>
        )}

        {!recoveryReady && !complete && (
          <Link
            href="/login"
            className="mt-5 block text-center text-sm text-zinc-400 hover:text-white"
          >
            Back to Staff Login
          </Link>
        )}
      </div>
    </main>
  );
}
