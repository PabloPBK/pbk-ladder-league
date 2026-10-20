"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Presentation = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export default function PresentationsPage() {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPresentations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tv-presentations", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load presentations"
        );
      }

      setPresentations(result.presentations ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load presentations"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPresentations();
  }, [loadPresentations]);

  async function createPresentation(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim() || saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/tv-presentations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to create presentation"
        );
      }

      setName("");
      setDescription("");
      setShowForm(false);
      setMessage("Presentation created successfully!");

      await loadPresentations();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create presentation"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout
      title="TV Presentations"
      description="Create and manage presentations for your Pickleball Kingdom TVs."
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
                🎬 Presentation Manager
              </h2>
              <p className="mt-2 text-zinc-400">
                Create presentations and organize content
                for your TVs.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black"
            >
              {showForm ? "Cancel" : "+ New Presentation"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={createPresentation}
              className="mt-6 space-y-4 rounded-xl border border-zinc-700 bg-zinc-950 p-6"
            >
              <h3 className="text-lg font-bold text-white">
                Create Presentation
              </h3>

              <div>
                <label
                  htmlFor="presentation-name"
                  className="mb-2 block text-sm text-zinc-400"
                >
                  Presentation Name
                </label>
                <input
                  id="presentation-name"
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: October Promotions"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="presentation-description"
                  className="mb-2 block text-sm text-zinc-400"
                >
                  Description (optional)
                </label>
                <textarea
                  id="presentation-description"
                  value={description}
                  maxLength={2000}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this presentation"
                  rows={3}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-white"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Presentation"}
              </button>
            </form>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-800 bg-red-950 p-4 text-red-300"
            >
              {error}
            </div>
          )}

          {message && (
            <p role="status" className="mt-6 text-green-400">
              {message}
            </p>
          )}

          <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-white">
                Your Presentations
              </h3>

              <button
                type="button"
                onClick={() => void loadPresentations()}
                disabled={loading}
                className="text-sm text-yellow-400 hover:underline disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {loading && (
              <p className="mt-4 text-zinc-400">
                Loading presentations...
              </p>
            )}

            {!loading && !error && presentations.length === 0 && (
              <p className="mt-4 text-zinc-400">
                No presentations created yet.
              </p>
            )}

            {!loading && presentations.length > 0 && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {presentations.map((presentation) => (
                  <div
                    key={presentation.id}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-bold text-white">
                        {presentation.name}
                      </h4>

                      <span
                        className={
                          presentation.is_active
                            ? "text-sm text-green-400"
                            : "text-sm text-zinc-500"
                        }
                      >
                        {presentation.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-zinc-400">
                      {presentation.description ||
                        "No description"}
                    </p>

                    <p className="mt-4 text-xs text-zinc-500">
                      Created:{" "}
                      {new Date(
                        presentation.created_at
                      ).toLocaleDateString()}
                    </p>

                    <Link
  href={`/admin/tv-manager/presentations/${presentation.id}`}
  className="mt-4 inline-block rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300"
>
  Manage Slides →
</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
