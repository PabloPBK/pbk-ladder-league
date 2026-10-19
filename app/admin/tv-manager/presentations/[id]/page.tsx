"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  title?: string | null;
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
  const [deletingId, setDeletingId] =
    useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingDurationId, setSavingDurationId] =
    useState<string | null>(null);
  const [draggedId, setDraggedId] =
    useState<string | null>(null);
  const [dragOverId, setDragOverId] =
    useState<string | null>(null);

  const [durations, setDurations] = useState<
    Record<string, number>
  >({});

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy =
    uploading ||
    deletingId !== null ||
    savingOrder ||
    savingDurationId !== null;

  useEffect(() => {
    let cancelled = false;

    async function loadPresentation() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/tv-presentations",
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load presentation"
          );
        }

        const found = (
          result.presentations as Presentation[]
        ).find(
          (item) => item.id === presentationId
        );

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

  const loadSlides = useCallback(async () => {
    setSlidesLoading(true);
    setUploadError("");

    try {
      const response = await fetch(
        `/api/tv-slides?presentation_id=${encodeURIComponent(
          presentationId
        )}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load slides"
        );
      }

      const loaded: Slide[] = Array.isArray(
        result.slides
      )
        ? result.slides
        : [];

      loaded.sort(
        (a, b) =>
          (a.sort_order ?? 0) -
          (b.sort_order ?? 0)
      );

      const nextDurations: Record<
        string,
        number
      > = {};

      for (const slide of loaded) {
        nextDurations[slide.id] =
          slide.duration_seconds ?? 10;
      }

      setSlides(loaded);
      setDurations(nextDurations);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to load slides"
      );
    } finally {
      setSlidesLoading(false);
    }
  }, [presentationId]);

  useEffect(() => {
    void loadSlides();
  }, [loadSlides]);

  async function uploadFile(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!file || busy) return;

    setUploading(true);
    setUploadError("");
    setMessage("");

    try {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/webm",
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          "Please select a JPG, PNG, WebP, MP4, or WebM file."
        );
      }

      if (file.size > 4 * 1024 * 1024) {
        throw new Error(
          "The maximum file size is currently 4 MB."
        );
      }

      const formData = new FormData();

      formData.append("file", file);
      formData.append(
        "presentation_id",
        presentationId
      );

      const response = await fetch(
        "/api/tv-slides",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to upload file"
        );
      }

      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadSlides();

      setMessage(
        "File uploaded successfully!"
      );
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to upload file"
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteSlide(
    slideId: string
  ) {
    if (busy) return;

    if (
      !window.confirm(
        "Are you sure you want to delete this slide? This cannot be undone."
      )
    ) {
      return;
    }

    setDeletingId(slideId);
    setUploadError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/tv-slides?id=${encodeURIComponent(
          slideId
        )}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to delete slide"
        );
      }

      setSlides((current) =>
        current.filter(
          (slide) => slide.id !== slideId
        )
      );

      setMessage(
        result.warning ||
          "Slide deleted successfully!"
      );
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to delete slide"
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function moveSlide(
    sourceId: string,
    targetId: string
  ) {
    if (
      busy ||
      sourceId === targetId
    ) {
      return;
    }

    const original = [...slides];

    const sourceIndex =
      original.findIndex(
        (slide) =>
          slide.id === sourceId
      );

    const targetIndex =
      original.findIndex(
        (slide) =>
          slide.id === targetId
      );

    if (
      sourceIndex < 0 ||
      targetIndex < 0
    ) {
      return;
    }

    const reordered = [...original];

    const [moved] =
      reordered.splice(
        sourceIndex,
        1
      );

    reordered.splice(
      targetIndex,
      0,
      moved
    );

    const updated =
      reordered.map(
        (slide, index) => ({
          ...slide,
          sort_order: index,
        })
      );

    setSlides(updated);
    setSavingOrder(true);
    setUploadError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/tv-slides/reorder",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            presentation_id:
              presentationId,
            slide_ids:
              updated.map(
                (slide) => slide.id
              ),
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save slide order"
        );
      }

      setMessage(
        "Slide order saved successfully!"
      );
    } catch (err) {
      setSlides(original);

      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to save slide order"
      );
    } finally {
      setSavingOrder(false);
    }
  }

  async function saveDuration(
    slideId: string
  ) {
    if (busy) return;

    const duration =
      durations[slideId];

    if (
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 60
    ) {
      setUploadError(
        "Duration must be between 5 and 60 seconds."
      );
      return;
    }

    setSavingDurationId(slideId);
    setUploadError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/tv-slides/duration",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            slide_id: slideId,
            duration_seconds:
              duration,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save duration"
        );
      }

      setSlides((current) =>
        current.map((slide) =>
          slide.id === slideId
            ? {
                ...slide,
                duration_seconds:
                  duration,
              }
            : slide
        )
      );

      setMessage(
        `Duration saved: ${duration} seconds.`
      );
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to save duration"
      );
    } finally {
      setSavingDurationId(null);
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
            <p
              role="alert"
              className="text-red-400"
            >
              {error}
            </p>
          )}

          {!loading &&
            presentation && (
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
                    Select an image or video
                    to add to this
                    presentation.
                  </p>

                  <form
                    onSubmit={uploadFile}
                    className="mt-5 space-y-4"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      onChange={(event) => {
                        setFile(
                          event.target.files?.[0] ??
                            null
                        );
                        setUploadError("");
                        setMessage("");
                      }}
                      className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-3 file:font-semibold file:text-white"
                    />

                    {file && (
                      <p className="text-sm text-zinc-400">
                        Selected:{" "}
                        {file.name} (
                        {(
                          file.size /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB)
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={
                        !file || busy
                      }
                      className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploading
                        ? "Uploading..."
                        : "Upload to Presentation"}
                    </button>
                  </form>
                </div>

                <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Presentation Slides
                      </h3>

                      <p className="mt-2 text-sm text-zinc-400">
                        Drag a slide onto
                        another slide to
                        change its position.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void loadSlides()
                      }
                      disabled={
                        slidesLoading ||
                        busy
                      }
                      className="text-sm text-yellow-400 hover:underline disabled:opacity-50"
                    >
                      Refresh
                    </button>
                  </div>

                  {uploadError && (
                    <p
                      role="alert"
                      className="mt-4 text-red-400"
                    >
                      {uploadError}
                    </p>
                  )}

                  {message && (
                    <p
                      role="status"
                      className="mt-4 text-green-400"
                    >
                      {message}
                    </p>
                  )}

                  {savingOrder && (
                    <p className="mt-4 text-yellow-400">
                      Saving slide order...
                    </p>
                  )}

                  {slidesLoading && (
                    <p className="mt-4 text-zinc-400">
                      Loading slides...
                    </p>
                  )}

                  {!slidesLoading &&
                    slides.length === 0 &&
                    !uploadError && (
                      <p className="mt-4 text-zinc-400">
                        No images or
                        videos added yet.
                      </p>
                    )}

                  {slides.length > 0 && (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {slides.map(
                        (slide, index) => (
                          <div
                            key={slide.id}
                            onDragOver={(
                              event
                            ) => {
                              if (
                                busy ||
                                !draggedId
                              )
                                return;

                              event.preventDefault();
                              setDragOverId(
                                slide.id
                              );
                            }}
                            onDrop={(
                              event
                            ) => {
                              event.preventDefault();

                              const sourceId =
                                draggedId;

                              setDraggedId(
                                null
                              );
                              setDragOverId(
                                null
                              );

                              if (
                                sourceId
                              ) {
                                void moveSlide(
                                  sourceId,
                                  slide.id
                                );
                              }
                            }}
                            className={`overflow-hidden rounded-xl border bg-zinc-900 ${
                              dragOverId ===
                                slide.id &&
                              draggedId !==
                                slide.id
                                ? "border-yellow-400 ring-2 ring-yellow-400"
                                : "border-zinc-700"
                            }`}
                          >
                            <div
                              draggable={
                                !busy
                              }
                              onDragStart={(
                                event
                              ) => {
                                if (
                                  busy
                                ) {
                                  event.preventDefault();
                                  return;
                                }

                                event.dataTransfer.effectAllowed =
                                  "move";

                                setDraggedId(
                                  slide.id
                                );
                              }}
                              onDragEnd={() => {
                                setDraggedId(
                                  null
                                );
                                setDragOverId(
                                  null
                                );
                              }}
                              className="cursor-grab border-b border-zinc-700 p-3 text-sm font-semibold text-yellow-400 active:cursor-grabbing"
                            >
                              ☰ Drag to move —
                              Slide{" "}
                              {index + 1}
                            </div>

                            {slide.media_type.startsWith(
                              "image"
                            ) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={
                                  slide.media_url
                                }
                                alt={
                                  slide.title ||
                                  "Presentation slide"
                                }
                                draggable={
                                  false
                                }
                                className="h-56 w-full object-contain"
                              />
                            ) : slide.media_type.startsWith(
                                "video"
                              ) ? (
                              <video
                                src={
                                  slide.media_url
                                }
                                controls
                                preload="metadata"
                                className="h-56 w-full"
                              />
                            ) : (
                              <p className="p-4 text-zinc-400">
                                Media preview
                                unavailable
                              </p>
                            )}

                            <div className="p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">
                                    {slide.title ||
                                      (slide.media_type.startsWith(
                                        "video"
                                      )
                                        ? "Video"
                                        : "Image")}
                                  </p>

                                  <p className="mt-1 text-xs text-zinc-400">
                                    {slide.media_type.startsWith(
                                      "video"
                                    )
                                      ? "Video"
                                      : "Image"}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteSlide(
                                      slide.id
                                    )
                                  }
                                  disabled={
                                    busy
                                  }
                                  className="rounded-lg border border-red-800 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950 disabled:opacity-50"
                                >
                                  {deletingId ===
                                  slide.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>

                              {slide.media_type.startsWith(
                                "image"
                              ) && (
                                <div className="mt-4 border-t border-zinc-700 pt-4">
                                  <label
                                    htmlFor={`duration-${slide.id}`}
                                    className="block text-sm font-semibold text-white"
                                  >
                                    Display
                                    Duration
                                  </label>

                                  <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <select
                                      id={`duration-${slide.id}`}
                                      value={
                                        durations[
                                          slide.id
                                        ] ?? 10
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setDurations(
                                          (
                                            current
                                          ) => ({
                                            ...current,
                                            [slide.id]:
                                              Number(
                                                event
                                                  .target
                                                  .value
                                              ),
                                          })
                                        )
                                      }
                                      disabled={
                                        busy
                                      }
                                      className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-white"
                                    >
                                      {[
                                        5, 10,
                                        15, 20,
                                        30, 45,
                                        60,
                                      ].map(
                                        (
                                          seconds
                                        ) => (
                                          <option
                                            key={
                                              seconds
                                            }
                                            value={
                                              seconds
                                            }
                                          >
                                            {
                                              seconds
                                            }{" "}
                                            seconds
                                          </option>
                                        )
                                      )}
                                    </select>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void saveDuration(
                                          slide.id
                                        )
                                      }
                                      disabled={
                                        busy ||
                                        (durations[
                                          slide.id
                                        ] ??
                                          10) ===
                                          (slide.duration_seconds ??
                                            10)
                                      }
                                      className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {savingDurationId ===
                                      slide.id
                                        ? "Saving..."
                                        : "Save Duration"}
                                    </button>
                                  </div>

                                  <p className="mt-2 text-xs text-zinc-400">
                                    This image
                                    will appear
                                    for{" "}
                                    {durations[
                                      slide.id
                                    ] ?? 10}{" "}
                                    seconds on
                                    the TV.
                                  </p>
                                </div>
                              )}

                              {slide.media_type.startsWith(
                                "video"
                              ) && (
                                <p className="mt-4 border-t border-zinc-700 pt-4 text-sm text-zinc-400">
                                  Video will
                                  play until
                                  it finishes.
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      )}
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
