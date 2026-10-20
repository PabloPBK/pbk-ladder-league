
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams } from "next/navigation";

type TeamEntry = {
  id: string;
  rank: number;
  player1: string;
  player2: string;
  player1_rating: number | null;
  player2_rating: number | null;
  combined_rating: number | null;
};

type FreeAgentEntry = {
  id: string;
  rank: number;
  name: string;
  rating: number | null;
};

type RosterData = {
  event_name: string;
  rating_method: string | null;
  entries: TeamEntry[] | FreeAgentEntry[];
};

type Slide = {
  id: string;
  title: string | null;
  media_type: string;
  media_url: string | null;
  sort_order: number;
  duration_seconds: number | null;
  roster?: RosterData;
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

function formatRating(value: number | null | undefined) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value.toFixed(2)
    : "NR";
}

function ratingLabel(method: string | null | undefined) {
  switch (method) {
    case "dupr_singles":
      return "DUPR Singles";
    case "club_rating":
      return "Club Rating";
    default:
      return "DUPR Doubles";
  }
}

function LiveRosterDisplay({
  slide,
}: {
  slide: Slide;
}) {
  const roster = slide.roster;
  const isTeams = slide.media_type === "roster_teams";
  const entries = roster?.entries ?? [];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black px-[3vw] py-[3vh] text-white">
      <header className="shrink-0 border-b-2 border-yellow-400 pb-[2vh]">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[clamp(13px,1.5vw,28px)] font-black uppercase tracking-[0.2em] text-yellow-400">
              Pickleball Kingdom
            </p>

            <h1 className="mt-2 truncate text-[clamp(26px,3.4vw,68px)] font-black uppercase leading-tight">
              {roster?.event_name ?? "Live Event"}
            </h1>

            <p className="mt-2 text-[clamp(15px,1.6vw,30px)] font-bold text-zinc-300">
              {isTeams
                ? "LIVE TEAM RANKINGS"
                : "LIVE FREE AGENTS"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className="rounded-xl border border-yellow-400 px-[2vw] py-[1vh]">
              <p className="text-[clamp(12px,1.1vw,22px)] uppercase tracking-wider text-zinc-400">
                Rating Method
              </p>
              <p className="mt-1 text-[clamp(16px,1.8vw,34px)] font-black text-yellow-400">
                {ratingLabel(roster?.rating_method)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <p className="text-[clamp(26px,3vw,56px)] font-black text-yellow-400">
              {isTeams
                ? "No Teams Assigned Yet"
                : "No Free Agents"}
            </p>
            <p className="mt-4 text-[clamp(16px,1.5vw,28px)] text-zinc-400">
              This display updates automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden pt-[2vh]">
          <div
            className="grid h-full grid-flow-col gap-x-[2vw] gap-y-[1vh]"
            style={{
              gridTemplateRows: `repeat(${Math.ceil(
                entries.length / 2
              )}, minmax(0, 1fr))`,
              gridTemplateColumns:
                entries.length > 8
                  ? "repeat(2, minmax(0, 1fr))"
                  : "minmax(0, 1fr)",
              gridAutoFlow: "column",
            }}
          >
            {entries.map((entry) => {
              if (isTeams) {
                const team = entry as TeamEntry;

                return (
                  <div
                    key={team.id}
                    className="flex min-h-0 items-center gap-[1.3vw] rounded-xl border border-zinc-800 bg-zinc-900 px-[1.4vw] py-[0.7vh]"
                  >
                    <div className="flex w-[clamp(38px,4vw,80px)] shrink-0 items-center justify-center rounded-lg bg-yellow-400 py-2 text-[clamp(20px,2.2vw,44px)] font-black text-black">
                      {team.rank}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[clamp(16px,1.9vw,38px)] font-bold leading-tight">
                        {team.player1}
                      </p>
                      <p className="truncate text-[clamp(16px,1.9vw,38px)] font-bold leading-tight">
                        {team.player2}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[clamp(22px,2.7vw,52px)] font-black leading-tight text-yellow-400">
                        {formatRating(team.combined_rating)}
                      </p>
                      <p className="text-[clamp(11px,1vw,20px)] text-zinc-400">
                        Combined
                      </p>
                    </div>
                  </div>
                );
              }

              const agent = entry as FreeAgentEntry;

              return (
                <div
                  key={agent.id}
                  className="flex min-h-0 items-center gap-[1.3vw] rounded-xl border border-zinc-800 bg-zinc-900 px-[1.4vw] py-[0.7vh]"
                >
                  <div className="flex w-[clamp(38px,4vw,80px)] shrink-0 items-center justify-center rounded-lg bg-yellow-400 py-2 text-[clamp(20px,2.2vw,44px)] font-black text-black">
                    {agent.rank}
                  </div>

                  <p className="min-w-0 flex-1 truncate text-[clamp(18px,2vw,40px)] font-bold">
                    {agent.name}
                  </p>

                  <p className="shrink-0 text-[clamp(22px,2.7vw,52px)] font-black text-yellow-400">
                    {formatRating(agent.rating)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer className="mt-[2vh] flex shrink-0 items-center justify-between border-t border-zinc-800 pt-[1.5vh] text-[clamp(12px,1.1vw,22px)] text-zinc-400">
        <span>
          {entries.length}{" "}
          {isTeams
            ? entries.length === 1
              ? "Team"
              : "Teams"
            : entries.length === 1
              ? "Free Agent"
              : "Free Agents"}
        </span>

        <span className="font-bold text-yellow-400">
          LIVE • AUTO UPDATING
        </span>
      </footer>
    </div>
  );
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
          { cache: "no-store" }
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

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load TV presentation"
        );
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
        currentSlide.media_type === "roster_teams" && (
          <LiveRosterDisplay slide={currentSlide} />
        )}

      {currentSlide &&
        currentSlide.media_type === "roster_free_agents" && (
          <LiveRosterDisplay slide={currentSlide} />
        )}

      {currentSlide &&
        currentSlide.media_type.startsWith("image") &&
        currentSlide.media_url && (
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
        currentSlide.media_type.startsWith("video") &&
        currentSlide.media_url && (
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
        !currentSlide.media_type.startsWith("video") &&
        currentSlide.media_type !== "roster_teams" &&
        currentSlide.media_type !== "roster_free_agents" && (
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
