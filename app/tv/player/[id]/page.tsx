"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Slide = {
  id: string;
  title: string | null;
  media_type: string;
  media_url: string;
  sort_order: number;
  duration_seconds: number | null;
};

type PlayerData = {
  screen: {
    id: string;
    name: string;
    display_mode?: "single" | "slideshow" | null;
    slide_duration?: number | null;
  };
  presentation: {
    id: string;
    name: string;
  } | null;
  slides: Slide[];
};

function getDuration(value: number | null | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 10;
  }

  return Math.max(1, Math.min(value, 3600));
}

export default function TVPlayerPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const screenId = params.id;
  const token = searchParams.get("token") ?? "";

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const playerRef = useRef<PlayerData | null>(null);
  const indexRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const slides = player?.slides ?? [];
  const currentSlide = slides[currentIndex] ?? null;

  // Preserve existing slideshow behavior until the
  // API supplies an explicit display mode.
  const displayMode =
    player?.screen.display_mode ?? "slideshow";

  const isSlideshow =
    displayMode === "slideshow" && slides.length > 1;

  const advanceSlide = useCallback(() => {
    const data = playerRef.current;

    if (!data) return;

    const nextSlides = data.slides ?? [];
    const mode = data.screen.display_mode ?? "slideshow";

    if (
      mode !== "slideshow" ||
      nextSlides.length <= 1
    ) {
      return;
    }

    setCurrentIndex((previous) => {
      const next = (previous + 1) % nextSlides.length;
      indexRef.current = next;
      return next;
    });
  }, []);

  // Load presentation and refresh it every 30 seconds.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    playerRef.current = null;
    indexRef.current = 0;

    setPlayer(null);
    setCurrentIndex(0);
    setLoading(true);
    setError("");

    if (!token) {
      setError(
        "This TV does not have a display access token."
      );
      setLoading(false);
      return;
    }

    async function loadPlayer() {
      if (inFlight || cancelled) return;

      inFlight = true;

      try {
        const query = new URLSearchParams({
          screen_id: screenId,
          token,
        });

        const response = await fetch(
          `/api/tv-player?${query.toString()}`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load TV presentation"
          );
        }

        if (cancelled) return;

        const nextPlayer = result as PlayerData;
        const previousPlayer = playerRef.current;

        const previousSignature = JSON.stringify({
          presentation:
            previousPlayer?.presentation?.id ?? null,
          mode:
            previousPlayer?.screen.display_mode ?? null,
          duration:
            previousPlayer?.screen.slide_duration ?? null,
          slides: (previousPlayer?.slides ?? []).map(
            (slide) => ({
              id: slide.id,
              type: slide.media_type,
              duration: slide.duration_seconds,
            })
          ),
        });

        const nextSignature = JSON.stringify({
          presentation:
            nextPlayer.presentation?.id ?? null,
          mode:
            nextPlayer.screen.display_mode ?? null,
          duration:
            nextPlayer.screen.slide_duration ?? null,
          slides: (nextPlayer.slides ?? []).map(
            (slide) => ({
              id: slide.id,
              type: slide.media_type,
              duration: slide.duration_seconds,
            })
          ),
        });

        if (
          previousSignature !== nextSignature ||
          indexRef.current >= nextPlayer.slides.length
        ) {
          indexRef.current = 0;
          setCurrentIndex(0);
        }

        playerRef.current = nextPlayer;
        setPlayer(nextPlayer);
        setError("");
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error
            ? err.message
            : "Unable to load TV presentation";

        setError(message);
      } finally {
        inFlight = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPlayer();

    const interval = window.setInterval(() => {
      void loadPlayer();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [screenId, token]);

  // Automatically advance images in slideshow mode.
  useEffect(() => {
    if (!currentSlide || !isSlideshow) return;

    if (currentSlide.media_type.startsWith("video")) {
      return;
    }

    const duration = getDuration(
      player?.screen.slide_duration ??
        currentSlide.duration_seconds
    );

    const timer = window.setTimeout(() => {
      advanceSlide();
    }, duration * 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentSlide?.id,
    currentSlide?.media_type,
    currentSlide?.duration_seconds,
    player?.screen.slide_duration,
    isSlideshow,
    advanceSlide,
  ]);

  // Retry video playback when the active slide changes.
  useEffect(() => {
    if (
      !currentSlide ||
      !currentSlide.media_type.startsWith("video")
    ) {
      return;
    }

    const video = videoRef.current;

    if (!video) return;

    video.currentTime = 0;

    void video.play().catch(() => {
      // Muted autoplay is supported by most TV browsers.
    });
  }, [currentSlide?.id, currentSlide?.media_type]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      {loading && !player && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-400">
              Pickleball Kingdom
            </p>
            <p className="mt-4 text-lg text-zinc-400">
              Loading TV presentation...
            </p>
          </div>
        </div>
      )}

      {!loading && error && !player && (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <p className="text-3xl font-bold text-yellow-400">
              TV Display Unavailable
            </p>

            <p className="mt-4 text-lg text-zinc-400">
              {error}
            </p>

            {token && (
              <p className="mt-3 text-sm text-zinc-500">
                This screen will automatically try again.
              </p>
            )}
          </div>
        </div>
      )}

      {player && !player.presentation && (
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <p className="text-4xl font-black text-yellow-400">
              Pickleball Kingdom
            </p>

            <p className="mt-5 text-xl text-zinc-300">
              {player.screen.name}
            </p>

            <p className="mt-3 text-zinc-500">
              Waiting for a presentation assignment...
            </p>
          </div>
        </div>
      )}

      {player &&
        player.presentation &&
        slides.length === 0 && (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <p className="text-4xl font-black text-yellow-400">
                Pickleball Kingdom
              </p>

              <p className="mt-5 text-xl text-zinc-300">
                {player.presentation.name}
              </p>

              <p className="mt-3 text-zinc-500">
                No slides have been added yet.
              </p>
            </div>
          </div>
        )}

      {currentSlide &&
        currentSlide.media_type.startsWith("image") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentSlide.id}
            src={currentSlide.media_url}
            alt={
              currentSlide.title ||
              "TV presentation"
            }
            className="h-full w-full object-contain"
            onError={advanceSlide}
          />
        )}

      {currentSlide &&
        currentSlide.media_type.startsWith("video") && (
          <video
            key={currentSlide.id}
            ref={videoRef}
            src={currentSlide.media_url}
            autoPlay
            muted
            playsInline
            preload="auto"
            loop={!isSlideshow}
            onEnded={
              isSlideshow ? advanceSlide : undefined
            }
            onError={
              isSlideshow ? advanceSlide : undefined
            }
            className="h-full w-full object-contain"
          />
        )}

      {currentSlide &&
        !currentSlide.media_type.startsWith("image") &&
        !currentSlide.media_type.startsWith("video") && (
          <div className="flex h-full items-center justify-center">
            <p className="text-zinc-400">
              Unsupported slide format
            </p>
          </div>
        )}

      {error && player && (
        <div className="absolute bottom-4 right-4 rounded-lg bg-black/70 px-3 py-2 text-xs text-zinc-400">
          Connection interrupted. Retrying...
        </div>
      )}
    </main>
  );
}
