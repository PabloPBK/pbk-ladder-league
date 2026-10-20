"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

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

type PreviewData = {
  presentation: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  slides: Slide[];
};

const ROSTER_PAGE_SIZE = 12;

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

function rosterPageCount(slide: Slide | null | undefined) {
  if (
    !slide ||
    (slide.media_type !== "roster_teams" &&
      slide.media_type !== "roster_free_agents")
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.ceil(
      (slide.roster?.entries?.length ?? 0) /
        ROSTER_PAGE_SIZE
    )
  );
}

function LiveRosterDisplay({
  slide,
  pageIndex,
  logoUrl,
}: {
  slide: Slide;
  pageIndex: number;
  logoUrl?: string | null;
}) {
  
  const roster = slide.roster;
  const isTeams = slide.media_type === "roster_teams";
  const allEntries = roster?.entries ?? [];

  const totalPages = rosterPageCount(slide);

  const safePageIndex = Math.min(
    Math.max(0, pageIndex),
    totalPages - 1
  );

  const entries = allEntries.slice(
    safePageIndex * ROSTER_PAGE_SIZE,
    (safePageIndex + 1) * ROSTER_PAGE_SIZE
  );

  const useTwoColumns = entries.length > 6;
  const midpoint = Math.ceil(entries.length / 2);

  const columns = useTwoColumns
    ? [
        entries.slice(0, midpoint),
        entries.slice(midpoint),
      ]
    : [entries];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black px-[2.5vw] py-[2.5vh] text-white">
      <header className="shrink-0 border-b-2 border-yellow-400 pb-[2vh]">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[clamp(14px,1.4vw,26px)] font-black uppercase tracking-[0.2em] text-yellow-400">
              Pickleball Kingdom
            </p>

            <h1 className="mt-2 truncate text-[clamp(28px,3.2vw,62px)] font-black uppercase leading-tight">
              {roster?.event_name ?? "Live Event"}
            </h1>

            <p className="mt-2 text-[clamp(16px,1.6vw,30px)] font-bold uppercase text-zinc-300">
              {isTeams
                ? "Live Team Rankings"
                : "Live Free Agents"}
            </p>
          </div>

          
<div className="flex shrink-0 items-center gap-[2vw]">
  <div className="rounded-xl border border-yellow-400 px-[2vw] py-[1vh] text-right">
    <p className="text-[clamp(12px,1vw,20px)] uppercase tracking-wider text-zinc-400">
      Rating Method
    </p>

    <p className="mt-1 text-[clamp(17px,1.7vw,32px)] font-black text-yellow-400">
      {ratingLabel(roster?.rating_method)}
    </p>
  </div>

  {logoUrl && (
    <div className="flex h-[clamp(80px,12vh,160px)] w-[clamp(80px,12vw,180px)] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt="Presentation logo"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  )}
</div>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <p className="text-[clamp(24px,2.8vw,52px)] font-black text-yellow-400">
              {isTeams
                ? "No Teams Assigned Yet"
                : "No Free Agents"}
            </p>

            <p className="mt-4 text-[clamp(16px,1.4vw,26px)] text-zinc-400">
              This display updates automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden pt-[2vh]">
          <div
            className="grid h-full gap-[1.5vw]"
            style={{
              gridTemplateColumns: useTwoColumns
                ? "repeat(2, minmax(0, 1fr))"
                : "minmax(0, 1fr)",
            }}
          >
            {columns.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className="flex min-w-0 flex-col gap-[1vh]"
              >
                {column.map((entry) => {
                  if (isTeams) {
                    const team = entry as TeamEntry;

                    return (
                      <div
                        key={team.id}
                        className="flex h-[clamp(72px,9.2vh,110px)] min-w-0 shrink-0 items-center gap-[1.2vw] rounded-xl border border-zinc-800 bg-zinc-900 px-[1.2vw]"
                      >
                        <div className="flex h-[clamp(42px,4.5vw,70px)] w-[clamp(42px,4.5vw,70px)] shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-[clamp(20px,2vw,38px)] font-black text-black">
                          {team.rank}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-3">
                            <p className="min-w-0 flex-1 truncate text-[clamp(15px,1.5vw,29px)] font-bold leading-tight">
                              {team.player1}
                            </p>

                            <span className="shrink-0 text-[clamp(11px,0.9vw,18px)] text-zinc-400">
                              {formatRating(
                                team.player1_rating
                              )}
                            </span>
                          </div>

                          <div className="mt-1 flex min-w-0 items-center gap-3">
                            <p className="min-w-0 flex-1 truncate text-[clamp(15px,1.5vw,29px)] font-bold leading-tight">
                              {team.player2}
                            </p>

                            <span className="shrink-0 text-[clamp(11px,0.9vw,18px)] text-zinc-400">
                              {formatRating(
                                team.player2_rating
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 border-l border-zinc-700 pl-[1vw] text-right">
                          <p className="text-[clamp(21px,2.2vw,42px)] font-black leading-tight text-yellow-400">
                            {formatRating(
                              team.combined_rating
                            )}
                          </p>

                          <p className="mt-1 text-[clamp(10px,0.8vw,16px)] text-zinc-400">
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
                      className="flex h-[clamp(68px,8.5vh,100px)] min-w-0 shrink-0 items-center gap-[1.2vw] rounded-xl border border-zinc-800 bg-zinc-900 px-[1.2vw]"
                    >
                      <div className="flex h-[clamp(40px,4vw,65px)] w-[clamp(40px,4vw,65px)] shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-[clamp(19px,1.9vw,36px)] font-black text-black">
                        {agent.rank}
                      </div>

                      <p className="min-w-0 flex-1 truncate text-[clamp(17px,1.7vw,32px)] font-bold">
                        {agent.name}
                      </p>

                      <p className="shrink-0 text-[clamp(21px,2.2vw,42px)] font-black text-yellow-400">
                        {formatRating(agent.rating)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="mt-[1vh] flex shrink-0 items-center justify-between border-t border-zinc-800 pt-[1.5vh] text-[clamp(12px,1vw,20px)] text-zinc-400">
        <span>
          {allEntries.length}{" "}
          {isTeams
            ? allEntries.length === 1
              ? "Team"
              : "Teams"
            : allEntries.length === 1
              ? "Free Agent"
              : "Free Agents"}
        </span>

        <span className="font-bold text-yellow-400">
          {totalPages > 1
            ? `PAGE ${safePageIndex + 1} OF ${totalPages} • `
            : ""}
          LIVE • AUTO UPDATING
        </span>
      </footer>
    </div>
  );
}

export default function PresentationPreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const presentationId = params.id;

  const [preview, setPreview] =
    useState<PreviewData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rosterPageIndex, setRosterPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const previewRef = useRef<PreviewData | null>(null);
  const indexRef = useRef(0);
  const rosterPageRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const slides = preview?.slides ?? [];
  const currentSlide = slides[currentIndex] ?? null;
  const isSlideshow = slides.length > 1;

  const exitPreview = useCallback(() => {
    router.push(
      `/admin/tv-manager/presentations/${presentationId}`
    );
  }, [router, presentationId]);

  const advanceSlide = useCallback(() => {
    const data = previewRef.current;
    if (!data) return;

    const activeSlide = data.slides[indexRef.current];
    const pages = rosterPageCount(activeSlide);

    if (rosterPageRef.current + 1 < pages) {
      const nextPage = rosterPageRef.current + 1;
      rosterPageRef.current = nextPage;
      setRosterPageIndex(nextPage);
      return;
    }

    if (data.slides.length <= 1) {
      if (pages > 1) {
        rosterPageRef.current = 0;
        setRosterPageIndex(0);
      }
      return;
    }

    const next =
      (indexRef.current + 1) % data.slides.length;

    indexRef.current = next;
    rosterPageRef.current = 0;

    setRosterPageIndex(0);
    setCurrentIndex(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    previewRef.current = null;
    indexRef.current = 0;
    rosterPageRef.current = 0;

    setPreview(null);
    setCurrentIndex(0);
    setRosterPageIndex(0);
    setLoading(true);
    setError("");

    async function loadPreview() {
      if (cancelled || inFlight) return;
      inFlight = true;

      try {
        const response = await fetch(
          `/api/tv-preview?presentation_id=${encodeURIComponent(
            presentationId
          )}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to load presentation preview"
          );
        }

        if (cancelled) return;

        const nextPreview = result as PreviewData;
        const previousPreview = previewRef.current;

        const previousSignature = JSON.stringify({
          presentation:
            previousPreview?.presentation?.id ?? null,
          slides: (previousPreview?.slides ?? []).map(
            (slide) => ({
              id: slide.id,
              type: slide.media_type,
              duration: slide.duration_seconds,
            })
          ),
        });

        const nextSignature = JSON.stringify({
          presentation:
            nextPreview.presentation?.id ?? null,
          slides: (nextPreview.slides ?? []).map(
            (slide) => ({
              id: slide.id,
              type: slide.media_type,
              duration: slide.duration_seconds,
            })
          ),
        });

        if (
          previousSignature !== nextSignature ||
          indexRef.current >= nextPreview.slides.length
        ) {
          indexRef.current = 0;
          rosterPageRef.current = 0;
          setCurrentIndex(0);
          setRosterPageIndex(0);
        } else {
          const active =
            nextPreview.slides[indexRef.current];
          const maxPage = rosterPageCount(active) - 1;

          if (rosterPageRef.current > maxPage) {
            rosterPageRef.current = maxPage;
            setRosterPageIndex(maxPage);
          }
        }

        previewRef.current = nextPreview;
        setPreview(nextPreview);
        setError("");
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load presentation preview"
        );
      } finally {
        inFlight = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreview();

    const interval = window.setInterval(() => {
      void loadPreview();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [presentationId]);

  useEffect(() => {
    if (!currentSlide) return;

    const hasMultipleRosterPages =
      rosterPageCount(currentSlide) > 1;

    if (!isSlideshow && !hasMultipleRosterPages) {
      return;
    }

    if (currentSlide.media_type.startsWith("video")) {
      return;
    }

    const duration = getDuration(
      currentSlide.duration_seconds
    );

    const timer = window.setTimeout(() => {
      advanceSlide();
    }, duration * 1000);

    return () => window.clearTimeout(timer);
  }, [
    currentSlide?.id,
    currentSlide?.media_type,
    currentSlide?.duration_seconds,
    currentSlide?.roster?.entries.length,
    rosterPageIndex,
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
      // Muted autoplay is supported by most browsers.
    });
  }, [currentSlide?.id, currentSlide?.media_type]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      {loading && !preview && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-400">
              Pickleball Kingdom
            </p>
            <p className="mt-4 text-lg text-zinc-400">
              Loading presentation preview...
            </p>
          </div>
        </div>
      )}

      {!loading && error && !preview && (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <p className="text-3xl font-bold text-yellow-400">
              Preview Unavailable
            </p>
            <p className="mt-4 text-lg text-zinc-400">
              {error}
            </p>
          </div>
        </div>
      )}

      {preview && slides.length === 0 && (
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <p className="text-4xl font-black text-yellow-400">
              Pickleball Kingdom
            </p>
            <p className="mt-5 text-xl text-zinc-300">
              {preview.presentation.name}
            </p>
            <p className="mt-3 text-zinc-500">
              No slides have been added yet.
            </p>
          </div>
        </div>
      )}

      {currentSlide &&
        (currentSlide.media_type === "roster_teams" ||
          currentSlide.media_type ===
            "roster_free_agents") && (     
<LiveRosterDisplay
  slide={currentSlide}
  pageIndex={rosterPageIndex}
  logoUrl={preview?.presentation.logo_url}
/>
        )}

      {currentSlide &&
        currentSlide.media_type.startsWith("image") &&
        currentSlide.media_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentSlide.id}
            src={currentSlide.media_url}
            alt={
              currentSlide.title || "Presentation preview"
            }
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
        currentSlide.media_type !==
          "roster_free_agents" && (
          <div className="flex h-full items-center justify-center">
            <p className="text-zinc-400">
              Unsupported slide format
            </p>
          </div>
        )}

      {error && preview && (
        <div className="absolute bottom-16 right-4 rounded-lg bg-black/70 px-3 py-2 text-xs text-zinc-400">
          Connection interrupted. Retrying...
        </div>
      )}
<div className="absolute bottom-5 right-5 z-50 flex items-center gap-3">
      <span className="rounded-lg bg-black/80 px-4 py-3 text-sm font-semibold text-yellow-400">
          PREVIEW MODE
        </span>

        <button
          type="button"
          onClick={exitPreview}
          className="rounded-lg bg-yellow-400 px-5 py-3 text-sm font-black text-black shadow-lg hover:bg-yellow-300"
        >
          ✕ Exit Preview
        </button>
      </div>
    </main>
  );
}
