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
  };
  presentation: {
    id: string;
    name: string;
  } | null;
  slides: Slide[];
};

export default function TVPlayerPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const screenId = params.id;
  const token = searchParams.get("token") ?? "";

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<PlayerData | null>(null);
  const indexRef = useRef(0);
  const mountedRef = useRef(true);

  const currentSlide = player?.slides[currentIndex] ?? null;

  const advanceSlide = useCallback(() => {
    const slides = playerRef.current?.slides ?? [];

    if (slides.length === 0) return;

    setCurrentIndex((previous) => {
      const next = (previous + 1) % slides.length;
      indexRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    playerRef.current = null;
    indexRef.current = 0;
    setPlayer(null);
    setCurrentIndex(0);
    setLoading(true);
    setError("");

    if (!token) {
      setError("This TV does not have a display access token.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    let inFlight = false;

    async function loadPlayer() {
      if (inFlight) return;
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
            result.error || "Unable to load TV presentation"
          );
        }

        if (cancelled || !mountedRef.current) return;

        const nextPlayer = result as PlayerData;
        const previousPlayer = playerRef.current;

        const previousSlides = previousPlayer?.slides ?? [];
        const nextSlides = nextPlayer.slides ?? [];

        const previousSignature = JSON.stringify({
          presentation: previousPlayer?.presentation?.id ?? null,
          slides: previousSlides.map((slide) => ({
            id: slide.id,
            duration: slide.duration_seconds,
          })),
        });

        const nextSignature = JSON.stringify({
          presentation: nextPlayer.presentation?.id ?? null,
          slides: nextSlides.map((slide) => ({
            id: slide.id,
            duration: slide.duration_seconds,
          })),
        });

        if (previousSignature !== nextSignature) {
          indexRef.current = 0;
          setCurrentIndex(0);
        } else if (indexRef.current >= nextSlides.length) {
          indexRef.current = 0;
          setCurrentIndex(0);
        }

        playerRef.current = nextPlayer;
        setPlayer(nextPlayer);
        setError("");
      } catch (err) {
        if (cancelled || !mountedRef.current) return;

        const message =
          err instanceof Error
            ? err.message
            : "Unable to load TV presentation";

        setError(message);
      } finally {
        inFlight = false;

        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void loadPlayer();

    // Check for presentation changes every 30 seconds.
    // This also renews the temporary media URLs.
    const interval = window.setInterval(() => {
      void loadPlayer();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [screenId, token]);

  useEffect(() => {
    if (!currentSlide) return;

    const isVideo =
      currentSlide.media_type.startsWith("video");

    if (isVideo) {
      const video = videoRef.current;

      if (video) {
        video.currentTime = 0;

        void video.play().catch(() => {
          // Some browsers require a user interaction
          // before allowing video playback.
        });
      }

      return;
    }

    const duration = Math.max(
      5,
      Math.min(currentSlide.duration_seconds ?? 10, 3600)
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
    advanceSlide,
  ]);

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
            <p className="mt-3 text-sm text-zinc-500">
              This screen will automatically try again.
            </p>
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
        player.slides.length === 0 && (
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
            alt={currentSlide.title || "TV presentation"}
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
            onEnded={advanceSlide}
            onError={advanceSlide}
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
