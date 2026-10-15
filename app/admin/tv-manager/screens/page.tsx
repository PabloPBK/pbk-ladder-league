"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type TVScreen = {
  id: string;
  name: string;
  location: string | null;
  display_mode: string | null;
  slide_duration: number | null;
  assigned_content: unknown;
  is_active: boolean;
};

export default function TVScreensPage() {
  const [screens, setScreens] = useState<TVScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadScreens() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tv-screens", {
  cache: "no-store",
});

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load TV screens"
        );
      }

      setScreens(result.screens ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load TV screens"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadScreens();
  }, []);

  return (
    <AppLayout
      title="TV Screens"
      description="Manage your Pickleball Kingdom TV displays."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/admin/tv-manager"
          className="text-yellow-400 hover:underline"
        >
          ← Back to TV Display Manager
        </Link>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white">
              TV Screen Management
            </h2>

            <button
              onClick={() => void loadScreens()}
              disabled={loading}
              className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black disabled:opacity-50"
            >
              Refresh Screens
            </button>
          </div>

          {loading && (
            <p className="mt-6 text-zinc-400">
              Loading TV screens...
            </p>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-800 bg-red-950 p-4 text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && screens.length === 0 && (
            <p className="mt-6 text-zinc-400">
              No TV screens registered yet.
            </p>
          )}

          {!loading && !error && screens.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {screens.map((screen) => (
                <div
                  key={screen.id}
                  className="rounded-xl border border-zinc-700 bg-zinc-950 p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-white">
                      📺 {screen.name}
                    </h3>

                    <span
                      className={
                        screen.is_active
                          ? "text-sm text-green-400"
                          : "text-sm text-zinc-500"
                      }
                    >
                      {screen.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-zinc-400">
                    <p>
                      Location: {screen.location || "Not set"}
                    </p>
                    <p>
                      Display Mode: {screen.display_mode || "Not set"}
                    </p>
                    <p>
                      Slide Duration: {screen.slide_duration ?? "Not set"} seconds
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
