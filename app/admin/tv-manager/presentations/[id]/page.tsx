"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Presentation = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Slide = {
  id: string;
  presentation_id: string;
  media_url: string;
  media_type: string;
  duration_seconds?: number | null;
  sort_order?: number | null;
};

export default function PresentationEditorPage() {
  const params = useParams<{ id: string }>();
  const presentationId = params.id;

  const [presentation, setPresentation] =
    useState<Presentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPresentation() {
      try {
        const response = await fetch("/api/tv-presentations", {
          cache: "no-store",
        });

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

        if (!cancelled) setPresentation(found);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load presentation"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPresentation();

    return () => {
      cancelled = true;
    };
  }, [presentationId]);

  async function loadSlides() {
    setSlidesLoading(true);

    try {
      const response = await fetch(
        `/api/tv-slides?presentation_id=${encodeURIComponent(
          presentationId
        )}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load slides");
      }

      setSlides(Array.isArray(result.slides) ? result.slides : []);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to load slides"
      );
    } finally {
      setSlidesLoading(false);
    }
  }

  useEffect(() => {
    void loadSlides();
    // Reload when the selected presentation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId]);

  async function uploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || uploading) return;

    setUploading(true);
    setUploadError("");
    setMessage("");

    try {
      if (
        !file.type.startsWith("image/") &&
        !file.type.startsWith("video/")
      ) {
        throw new Error("Please select an image or video file.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("presentation_id", presentationId);

      const response = await fetch("/api/tv-slides", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setMessage("File uploaded successfully!");
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadSlides();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  }

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
                  Upload Images or Videos
                </h3>

                <p className="mt-2 text-sm text-zinc-400">
                  Select an image or video to add to this
                  presentation.
                </p>

                <form
                  onSubmit={uploadFile}
                  className="mt-5 space-y-4"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setUploadError("");
                      setMessage("");
                    }}
                    className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-3 file:font-semibold file:text-white"
                  />

                  {file && (
                    <p className="text-sm text-zinc-400">
                      Selected: {file.name} (
                      {(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!file || uploading}
                    className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading
                      ? "Uploading..."
                      : "Upload to Presentation"}
                  </button>
                </form>

                {uploadError && (
                  <p role="alert" className="mt-4 text-red-400">
                    {uploadError}
                  </p>
                )}

                {message && (
                  <p role="status" className="mt-4 text-green-400">
                    {message}
                  </p>
                )}
              </div>

              <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-white">
                    Presentation Slides
                  </h3>

                  <button
                    type="button"
                    onClick={() => void loadSlides()}
                    disabled={slidesLoading}
                    className="text-sm text-yellow-400 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {slidesLoading && (
                  <p className="mt-4 text-zinc-400">
                    Loading slides...
                  </p>
                )}

                {!slidesLoading && slides.length === 0 && (
                  <p className="mt-4 text-zinc-400">
                    No images or videos added yet.
                  </p>
                )}

                {slides.length > 0 && (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {slides.map((slide) => (
                      <div
                        key={slide.id}
                        className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900"
                      >
                        {slide.media_type.startsWith("image") ? (
                          // Media URL comes from the TV slides API.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slide.media_url}
                            alt="Presentation slide"
                            className="h-56 w-full object-contain"
                          />
                        ) : slide.media_type.startsWith("video") ? (
                          <video
                            src={slide.media_url}
                            controls
                            preload="metadata"
                            className="h-56 w-full"
                          />
                        ) : (
                          <p className="p-4 text-zinc-400">
                            Media preview unavailable
                          </p>
                        )}

                        <div className="p-4">
                          <p className="text-sm text-zinc-400">
                            {slide.media_type.startsWith("video")
                              ? "Video"
                              : "Image"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
