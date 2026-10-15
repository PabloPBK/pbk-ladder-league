"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type TVScreen = {
  id: string;
  name: string;
  location: string | null;
  display_mode: string | null;
  slide_duration: number | null;
  is_active: boolean;
};

export default function TVScreenSettingsPage() {
  const params = useParams<{ id: string }>();
  const screenId = params.id;

  const [screen, setScreen] = useState<TVScreen | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadScreen() {
      try {
        const response = await fetch("/api/tv-screens", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load TV screen"
          );
        }

        const found = (result.screens as TVScreen[]).find(
          (item) => item.id === screenId
        );

        if (!found) {
          throw new Error("TV screen not found");
        }

        if (!cancelled) {
          setScreen(found);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load TV screen"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadScreen();

    return () => {
      cancelled = true;
    };
  }, [screenId]);

  async function saveChanges() {
    if (!screen) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/tv-screens/${encodeURIComponent(screenId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: screen.name,
            location: screen.location,
            display_mode: screen.display_mode,
            slide_duration: screen.slide_duration,
            is_active: screen.is_active,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save TV settings"
        );
      }

      setMessage("TV settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save TV settings"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout
      title="TV Settings"
      description="Configure an individual TV display."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/tv-manager/screens"
          className="text-yellow-400 hover:underline"
        >
          ← Back to TV Screens
        </Link>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-bold text-white">
            📺 TV Screen Settings
          </h2>

          {loading && (
            <p className="mt-6 text-zinc-400">
              Loading TV settings...
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-red-800 bg-red-950 p-4 text-red-300"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="mt-6 text-green-400"
            >
              {message}
            </p>
          )}

          {!loading && screen && (
            <div className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="tv-name"
                  className="mb-2 block text-sm text-zinc-400"
                >
                  TV Name
                </label>

                <input
                  id="tv-name"
                  value={screen.name}
                  onChange={(e) =>
                    setScreen({
                      ...screen,
                      name: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="tv-location"
                  className="mb-2 block text-sm text-zinc-400"
                >
                  Location
                </label>

                <input
                  id="tv-location"
                  value={screen.location ?? ""}
                  onChange={(e) =>
                    setScreen({
                      ...screen,
                      location: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="display-mode"
                  className="mb-2 block text-sm text-zinc-400"
                >
                  Display Mode
                </label>

                <select
                  id="display-mode"
                  value={screen.display_mode ?? "single"}
                  onChange={(e) =>
                    setScreen({
                      ...screen,
                      display_mode: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white"
                >
                  <option value="single">Single Display</option>
                  <option value="slideshow">Slideshow</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="slide-duration"
                  className="mb-2 block text-sm text-zinc-400"
                >
                  Slide Duration (seconds)
                </label>

                <input
                  id="slide-duration"
                  type="number"
                  min="1"
                  max="3600"
                  value={screen.slide_duration ?? 10}
                  onChange={(e) =>
                    setScreen({
                      ...screen,
                      slide_duration: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white"
                />
              </div>

              <label className="flex items-center gap-3 text-white">
                <input
                  type="checkbox"
                  checked={screen.is_active}
                  onChange={(e) =>
                    setScreen({
                      ...screen,
                      is_active: e.target.checked,
                    })
                  }
                />
                TV Active
              </label>

              <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-4">
                <p className="text-sm text-zinc-400">
                  Screen ID
                </p>
                <p className="mt-2 break-all font-mono text-sm text-white">
                  {screen.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void saveChanges()}
                disabled={
                  saving ||
                  !screen.name.trim() ||
                  !Number.isInteger(screen.slide_duration) ||
                  screen.slide_duration < 1 ||
                  screen.slide_duration > 3600
                }
                className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
