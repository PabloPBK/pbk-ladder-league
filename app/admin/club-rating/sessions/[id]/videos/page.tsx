
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Player = {
  id: string;
  full_name: string;
  attendance_status: string;
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

const EMPTY_SCORES: Score[] = Array.from(
  { length: 4 },
  () => ({ playerId: "", rating: "" })
);

function newVideoId() {
  return crypto.randomUUID();
}

export default function PBVisionScoresPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Score[]>(
    EMPTY_SCORES.map((s) => ({ ...s }))
  );
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
        setPlayers(
          (data.players || []).filter(
            (p: Player) =>
              p.attendance_status === "attended"
          )
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

    const selected = scores.map((s) => s.playerId);

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
        (s) =>
          s.rating.trim() === "" ||
          !Number.isFinite(Number(s.rating)) ||
          Number(s.rating) < 0 ||
          Number(s.rating) > 8
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
            scores: scores.map((s) => ({
              playerId: s.playerId,
              rating: Number(s.rating),
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
        `Game ${data.result.gameNumber} saved successfully. Four player ratings recorded.`
      );

      setScores(
        EMPTY_SCORES.map((s) => ({ ...s }))
      );
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
    return <div className="p-6">Loading players...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <a
        href={`/admin/club-rating/sessions/${sessionId}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to Session
      </a>

      <h1 className="mt-5 text-3xl font-bold">
        PB Vision Score Entry
      </h1>

      {session && (
        <p className="mt-2 text-gray-600">
          {session.session_name || "Club Rating Session"}
          {" — "}
          {session.session_date}
        </p>
      )}

      <p className="mt-4 text-sm text-gray-600">
        Select four players from the session roster
        and enter their individual PB Vision game ratings.
        Each saved video counts as one game per player.
      </p>

      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">
          New Video
        </h2>

        <p className="mt-1 text-xs text-gray-500">
          Video ID: {videoId}
        </p>

        {scores.map((score, index) => (
          <div
            key={index}
            className="mt-5 grid gap-3 border-b pb-5 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Player {index + 1}
              </label>

              <select
                value={score.playerId}
                onChange={(e) =>
                  updateScore(
                    index,
                    "playerId",
                    e.target.value
                  )
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="">
                  Select Player
                </option>

                {players.map((player) => (
                  <option
                    key={player.id}
                    value={player.id}
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
              <label className="mb-1 block text-sm font-medium">
                PB Vision Rating
              </label>

              <input
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
                placeholder="e.g. 3.850"
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>
        ))}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        <button
          type="button"
          onClick={saveVideo}
          disabled={
            saving ||
            players.length < 4 ||
            !videoId ||
            !session ||
            !["scheduled", "in_progress"].includes(
              session.status
            )
          }
          className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Video — 4 Ratings"}
        </button>

        {players.length < 4 && (
          <p className="mt-3 text-sm text-amber-700">
            At least four attended players are required.
          </p>
        )}
      </div>
    </div>
  );
}
