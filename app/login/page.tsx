"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [isSigningIn, setIsSigningIn] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!email || !password) {
      setErrorMessage(
        "Enter your email and password.",
      );
      return;
    }

    try {
      setIsSigningIn(true);
      setErrorMessage("");

      const supabase = createClient();

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw error;
      }

      /*
       * Read the requested destination only
       * in the browser, after login.
       */
      const params =
        new URLSearchParams(
          window.location.search,
        );

      const requestedPath =
        params.get("next");

      const nextPath =
        requestedPath &&
        requestedPath.startsWith("/")
          ? requestedPath
          : "/admin";

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-400">
            Pickleball Kingdom
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Staff Login
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Sign in to access Admin and Runner.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-bold text-zinc-300"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none transition focus:border-blue-500"
              placeholder="staff@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-bold text-zinc-300"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none transition focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSigningIn}
            className="h-12 w-full rounded-xl bg-blue-600 px-5 font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {isSigningIn
              ? "Signing In..."
              : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Authorized staff only
        </p>
      </div>
    </main>
  );
}