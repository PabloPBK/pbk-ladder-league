
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Player = {
  id: string;
  full_name: string;
  attendance_status: string;
};

type RosterPlayer = {
  id: string;
  club_rating_player_id: string;
  attendance_status: string;
  club_rating_players: {
    id: string;
    full_name: string;
  } | null;
};
type Session = {
  id: string;
  session_name: string | null;
  session_date: string;
  status: string;
};

type Score = {
  playerId: string;
  rating: string;
};

function emptyScores(): Score[] {
  return Array.from({ length: 4 }, () => ({
    playerId: "",
    rating: "",
  }));
}

function newVideoId() {
  return crypto.randomUUID();
}

const inputClass =
  "w-full rounded-lg border border-gray-600 bg-gray-950 " +
  "px-4 py-3 text-white placeholder:text-gray-500 " +
  "focus:border-blue-500 focus:outline-none " +
  "focus:ring-2 focus:ring-blue-500/30";

const labelClass =
  "mb-2 block text-sm font-medium text-gray-200";

export default function PBVisionScoresPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] =
    useState<Session | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [scores, setScores] =
    useState<Score[]>(emptyScores);

  const [videoId, setVideoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setVideoId(newVideoId());

    async function loadRoster() {
      try {
        const response = await fetch(
          `/api/club-rating/sessions/${sessionId}/players`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load session."
          );
        }

        setSession(data.session);

        const rosterPlayers = (data.players || []) as RosterPlayer[];

setPlayers(
  rosterPlayers
    .filter(
      (p) =>
        p.attendance_status === "attended" &&
        p.club_rating_players !== null
    )
    .map((p) => ({
      id: p.club_rating_player_id,
      full_name: p.club_rating_players!.full_name,
      attendance_status: p.attendance_status,
    }))
);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load players."
        );
      } finally {
        setLoading(false);
      }
    }

    if (sessionId) {
      loadRoster();
    }
  }, [sessionId]);

  function updateScore(
    index: number,
    field: keyof Score,
    value: string
  ) {
    setScores((current) =>
      current.map((score, i) =>
        i === index
          ? { ...score, [field]: value }
          : score
      )
    );

    setError("");
    setSuccess("");
  }

  async function saveVideo() {
    setError("");
    setSuccess("");

    const selected = scores.map(
      (score) => score.playerId
    );

    if (selected.some((id) => !id)) {
      setError("Select all four players.");
      return;
    }

    if (new Set(selected).size !== 4) {
      setError(
        "Each player can only appear once per video."
      );
      return;
    }

    if (
      scores.some(
        (score) =>
          score.rating.trim() === "" ||
          !Number.isFinite(Number(score.rating)) ||
          Number(score.rating) < 0 ||
          Number(score.rating) > 8
      )
    ) {
      setError(
        "Enter a valid PB Vision rating (0–8) for every player."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/club-rating/videos",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            videoId,
            scores: scores.map((score) => ({
              playerId: score.playerId,
              rating: Number(score.rating),
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save video."
        );
      }

      setSuccess(
        `Game ${data.result.gameNumber} saved successfully. ` +
        "Four player ratings recorded."
      );

      setScores(emptyScores());
      setVideoId(newVideoId());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save video."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-gray-300">
        Loading players...
      </div>
    );
  }

  const canSave =
    !saving &&
    players.length >= 4 &&
    Boolean(videoId) &&
    Boolean(session) &&
    ["scheduled", "in_progress"].includes(
      session?.status ?? ""
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-white sm:px-6">
      <a
        href={`/admin/club-rating/sessions/${sessionId}`}
        className="text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline"
      >
        ← Back to Session
      </a>

      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          PB Vision Score Entry
        </h1>

        {session && (
          <p className="mt-2 text-gray-400">
            {session.session_name ||
              "Club Rating Session"}
            {" — "}
            {session.session_date}
          </p>
        )}

        <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-400">
          Select four players from the session roster
          and enter their individual PB Vision game ratings.
          Each saved video counts as one game per player.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-700 bg-[#18181b] shadow-xl">
        <div className="border-b border-gray-700 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">
                New Video
              </h2>

              <p className="mt-1 text-sm text-gray-400">
                Enter ratings for all four players.
              </p>
            </div>

            <span className="rounded-full border border-blue-800 bg-blue-950 px-3 py-1 text-xs font-medium text-blue-300">
              4 Players
            </span>
          </div>

          <p className="mt-4 break-all text-xs text-gray-500">
            Video ID: {videoId}
          </p>
        </div>

        <div className="px-6 py-2">
          {scores.map((score, index) => (
            <div
              key={index}
              className="grid gap-4 border-b border-gray-700 py-6 last:border-b-0 md:grid-cols-2"
            >
              <div>
                <label
                  htmlFor={`player-${index}`}
                  className={labelClass}
                >
                  Player {index + 1}
                </label>

                <select
                  id={`player-${index}`}
                  value={score.playerId}
                  onChange={(e) =>
                    updateScore(
                      index,
                      "playerId",
                      e.target.value
                    )
                  }
                  disabled={saving}
                  className={inputClass}
                >
                  <option value="" style={{ color: "#111827", backgroundColor: "#ffffff" }}>
  Select Player
</option>
                  {players.map((player) => (
                    <option
                      key={player.id}
                      value={player.id}
                      style={{ color: "#111827", backgroundColor: "#ffffff" }}
                      disabled={scores.some(
                        (s, i) =>
                          i !== index &&
                          s.playerId === player.id
                      )}
                    >
                      {player.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`rating-${index}`}
                  className={labelClass}
                >
                  PB Vision Rating
                </label>

                <input
                  id={`rating-${index}`}
                  type="number"
                  min="0"
                  max="8"
                  step="0.001"
                  value={score.rating}
                  onChange={(e) =>
                    updateScore(
                      index,
                      "rating",
                      e.target.value
                    )
                  }
                  disabled={saving}
                  placeholder="e.g. 3.850"
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-700 bg-[#202024] px-6 py-6">
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-green-800 bg-green-950/50 p-4 text-sm text-green-200"
            >
              {success}
            </div>
          )}

          <button
            type="button"
            onClick={saveVideo}
            disabled={!canSave}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving
              ? "Saving..."
              : "Save Video — 4 Ratings"}
          </button>

          {players.length < 4 && (
            <p className="mt-4 text-sm text-amber-400">
              At least four attended players are required.
            </p>
          )}

          {session &&
            !["scheduled", "in_progress"].includes(
              session.status
            ) && (
              <p className="mt-4 text-sm text-amber-400">
                This session is not accepting new scores.
              </p>
            )}

          <p className="mt-4 text-xs leading-5 text-gray-500">
            PB Vision game scores are recorded individually.
            Saving a video does not automatically change
            a player's official Club Rating.
          </p>
        </div>
      </div>
    </div>
  );
}
