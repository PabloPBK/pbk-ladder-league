
"use client";

import { useCallback, useEffect, useState } from "react";
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
  presentation_id: string | null;
};

type Presentation = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function TVScreensPage() {
  const [screens, setScreens] = useState<TVScreen[]>([]);
  const [presentations, setPresentations] = useState<
    Presentation[]
  >([]);

  const [assignments, setAssignments] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");

  const [messages, setMessages] = useState<
    Record<string, string>
  >({});

  const loadScreens = useCallback(async () => {
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

      const loadedScreens: TVScreen[] = Array.isArray(
        result.screens
      )
        ? result.screens
        : [];

      const loadedPresentations: Presentation[] =
        Array.isArray(result.presentations)
          ? result.presentations
          : [];

      const initialAssignments: Record<string, string> = {};

      for (const screen of loadedScreens) {
        initialAssignments[screen.id] =
          screen.presentation_id ?? "";
      }

      setScreens(loadedScreens);
      setPresentations(loadedPresentations);
      setAssignments(initialAssignments);
      setMessages({});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load TV screens"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScreens();
  }, [loadScreens]);

  async function saveAssignment(screenId: string) {
    if (savingId !== null) return;

    const selectedId = assignments[screenId] || null;

    setSavingId(screenId);
    setError("");

    setMessages((current) => ({
      ...current,
      [screenId]: "",
    }));

    try {
      const response = await fetch("/api/tv-screens", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          screen_id: screenId,
          presentation_id: selectedId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save assignment"
        );
      }

      setScreens((current) =>
        current.map((screen) =>
          screen.id === screenId
            ? {
                ...screen,
                presentation_id: selectedId,
              }
            : screen
        )
      );

      setMessages((current) => ({
        ...current,
        [screenId]: "Assignment saved successfully!",
      }));
    } catch (err) {
      setMessages((current) => ({
        ...current,
        [screenId]:
          err instanceof Error
            ? err.message
            : "Unable to save assignment",
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function launchTV(screenId: string) {
    if (launchingId !== null) return;

    // Open the tab immediately so Safari
    // does not block it as a popup.
    const newTab = window.open("", "_blank");

    if (!newTab) {
      setMessages((current) => ({
        ...current,
        [screenId]:
          "Popup blocked. Please allow popups for this site.",
      }));
      return;
    }

    setLaunchingId(screenId);

    setMessages((current) => ({
      ...current,
      [screenId]: "",
    }));

    try {
      const response = await fetch(
        `/api/tv-screens/${encodeURIComponent(screenId)}/launch`,
        {
          method: "POST",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to launch TV display"
        );
      }

      if (
        typeof result.url !== "string" ||
        !result.url
      ) {
        throw new Error(
          "The TV launch API did not return a valid URL."
        );
      }

      // Only navigate to a player URL on this site.
      const playerUrl = new URL(result.url, window.location.origin);

      if (
        playerUrl.origin !== window.location.origin ||
        playerUrl.protocol !== window.location.protocol ||
        playerUrl.pathname !==
          `/tv/player/${encodeURIComponent(screenId)}` ||
        !playerUrl.searchParams.get("token")
      ) {
        throw new Error(
          "The TV launch API returned an invalid player URL."
        );
      }

      newTab.location.replace(playerUrl.toString());
    } catch (err) {
      newTab.close();

      setMessages((current) => ({
        ...current,
        [screenId]:
          err instanceof Error
            ? err.message
            : "Unable to launch TV display",
      }));
    } finally {
      setLaunchingId(null);
    }
  }

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
            <div>
              <h2 className="text-2xl font-bold text-white">
                TV Screen Management
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Assign presentations to individual TVs.
                Multiple TVs can play the same presentation.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadScreens()}
              disabled={
                loading ||
                savingId !== null ||
                launchingId !== null
              }
              className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh Screens"}
            </button>
          </div>

          {loading && (
            <p className="mt-6 text-zinc-400">
              Loading TV screens...
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-800 bg-red-950 p-4 text-red-300"
            >
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
              {screens.map((screen) => {
                const selectedId =
                  assignments[screen.id] ?? "";

                const hasChanges =
                  selectedId !==
                  (screen.presentation_id ?? "");

                const currentPresentation =
                  presentations.find(
                    (item) =>
                      item.id === screen.presentation_id
                  );

                const isSaving =
                  savingId === screen.id;

                const isLaunching =
                  launchingId === screen.id;

                return (
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
                        Location:{" "}
                        {screen.location || "Not set"}
                      </p>

                      <p>
                        Display Mode:{" "}
                        {screen.display_mode || "Not set"}
                      </p>

                      <p>
                        Slide Duration:{" "}
                        {screen.slide_duration ?? "Not set"}{" "}
                        seconds
                      </p>
                    </div>

                    <div className="mt-5 border-t border-zinc-700 pt-5">
                      <label
                        htmlFor={`presentation-${screen.id}`}
                        className="block text-sm font-bold text-white"
                      >
                        Assigned Presentation
                      </label>

                      <select
                        id={`presentation-${screen.id}`}
                        value={selectedId}
                        onChange={(event) => {
                          setAssignments((current) => ({
                            ...current,
                            [screen.id]:
                              event.target.value,
                          }));

                          setMessages((current) => ({
                            ...current,
                            [screen.id]: "",
                          }));
                        }}
                        disabled={savingId !== null}
                        className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-3 text-sm text-white disabled:opacity-50"
                      >
                        <option value="">
                          No presentation assigned
                        </option>

                        {screen.presentation_id &&
                          !currentPresentation && (
                            <option
                              value={
                                screen.presentation_id
                              }
                            >
                              Current presentation
                              (unavailable)
                            </option>
                          )}

                        {presentations.map(
                          (presentation) => (
                            <option
                              key={presentation.id}
                              value={presentation.id}
                            >
                              {presentation.name}
                              {!presentation.is_active
                                ? " (Inactive)"
                                : ""}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          void saveAssignment(screen.id)
                        }
                        disabled={
                          savingId !== null ||
                          !hasChanges
                        }
                        className="mt-3 w-full rounded-lg bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving
                          ? "Saving..."
                          : "Save Assignment"}
                      </button>

                      {messages[screen.id] && (
                        <p
                          role="status"
                          className={`mt-3 text-sm ${
                            messages[screen.id] ===
                            "Assignment saved successfully!"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {messages[screen.id]}
                        </p>
                      )}

                      <p className="mt-3 text-xs text-zinc-400">
                        Currently assigned:{" "}
                        <span className="text-white">
                          {currentPresentation?.name ||
                            (screen.presentation_id
                              ? "Unknown presentation"
                              : "None")}
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void launchTV(screen.id)
                      }
                      disabled={
                        launchingId !== null ||
                        !screen.is_active
                      }
                      className="mt-5 block w-full rounded-lg border border-yellow-400 px-4 py-3 text-center text-sm font-bold text-yellow-400 transition hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLaunching
                        ? "Launching TV..."
                        : "Open TV Display ↗"}
                    </button>

                    <Link
                      href={`/admin/tv-manager/screens/${encodeURIComponent(
                        screen.id
                      )}`}
                      className="mt-4 block border-t border-zinc-700 pt-4 text-sm font-semibold text-yellow-400 hover:underline"
                    >
                      Manage TV Settings →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
