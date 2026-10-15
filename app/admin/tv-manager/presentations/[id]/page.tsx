"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Presentation = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export default function PresentationEditorPage() {
  const params = useParams<{ id: string }>();
  const presentationId = params.id;

  const [presentation, setPresentation] =
    useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPresentation() {
      try {
        const response = await fetch(
          "/api/tv-presentations",
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load presentation"
          );
        }

        const found = (
          result.presentations as Presentation[]
        ).find((item) => item.id === presentationId);

        if (!found) {
          throw new Error("Presentation not found");
        }

        if (!cancelled) {
          setPresentation(found);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load presentation"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPresentation();

    return () => {
      cancelled = true;
    };
  }, [presentationId]);

  return (
    <AppLayout
      title="Presentation Editor"
      description="Manage images and videos for your TVs."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/admin/tv-manager/presentations"
          className="text-yellow-400 hover:underline"
        >
          ← Back to Presentations
        </Link>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          {loading && (
            <p className="text-zinc-400">
              Loading presentation...
            </p>
          )}

          {error && (
            <p role="alert" className="text-red-400">
              {error}
            </p>
          )}

          {!loading && presentation && (
            <>
              <h2 className="text-2xl font-bold text-white">
                🎬 {presentation.name}
              </h2>

              <p className="mt-2 text-zinc-400">
                {presentation.description ||
                  "No description provided."}
              </p>

              <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
                <h3 className="text-lg font-bold text-white">
                  Presentation Slides
                </h3>

                <p className="mt-3 text-zinc-400">
                  No images or videos added yet.
                </p>

                <p className="mt-4 text-sm text-yellow-400">
                  Image and video uploads will be
                  connected in the next step.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
