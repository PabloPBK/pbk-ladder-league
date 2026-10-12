
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";

type PlayerRecord = {
  id: string;
  name: string;
  dupr: number;
  dupr_id: string | null;
};

type PlayerForm = {
  name: string;
  dupr: string;
  duprId: string;
};

export default function PlayerDirectoryPage() {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState<PlayerForm>({
    name: "",
    dupr: "",
    duprId: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPlayers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/players", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load players."
        );
      }

      setPlayers(result.players ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load players."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  const missingCount = useMemo(
    () => players.filter((player) => !player.dupr_id?.trim()).length,
    [players]
  );

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return players.filter((player) => {
      const matchesSearch =
        player.name.toLowerCase().includes(term) ||
        (player.dupr_id ?? "").toLowerCase().includes(term);

      const matchesMissing =
        !missingOnly || !player.dupr_id?.trim();

      return matchesSearch && matchesMissing;
    });
  }, [players, search, missingOnly]);

  const selectedPlayer = players.find(
    (player) => player.id === selectedId
  );

  function selectPlayer(player: PlayerRecord) {
    if (saving) return;

    setSelectedId(player.id);
    setForm({
      name: player.name,
      dupr: String(player.dupr),
      duprId: player.dupr_id ?? "",
    });

    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    if (saving) return;

    setSelectedId(null);
    setError("");
    setSuccess("");
  }

  async function savePlayer() {
    if (!selectedId || saving) return;

    const name = form.name.trim();
    const ratingText = form.dupr.trim();
    const dupr = Number(ratingText);

    if (!name) {
      setError("Player name cannot be empty.");
      return;
    }

    if (
      !ratingText ||
      !Number.isFinite(dupr) ||
      dupr < 0 ||
      dupr > 8
    ) {
      setError("Enter a DUPR rating between 0 and 8. Use 0 for unrated.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/players/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            dupr,
            duprId: form.duprId.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save player."
        );
      }

      const updated = result.player;

      setPlayers((current) =>
        current.map((player) =>
          player.id === selectedId
            ? {
                ...player,
                name: updated.name,
                dupr: Number(updated.dupr),
                dupr_id: updated.duprId ?? null,
              }
            : player
        )
      );

      setForm({
        name: updated.name,
        dupr: String(updated.dupr),
        duprId: updated.duprId ?? "",
      });

      setSuccess("Player information saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save player."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout
      title="Player Directory"
      description="Search and manage saved players, DUPR ratings, and DUPR IDs."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Total Players</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {players.length}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Players With DUPR IDs
            </p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {players.length - missingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Missing DUPR IDs
            </p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">
              {missingCount}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or DUPR ID..."
              className="min-h-12 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none focus:border-blue-500"
            />

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(event) =>
                  setMissingOnly(event.target.checked)
                }
                className="h-4 w-4"
              />
              Missing DUPR IDs only
            </label>

            <button
              type="button"
              onClick={() => void loadPlayers()}
              disabled={loading || saving}
              className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300"
          >
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-4">
              <h2 className="font-bold text-white">
                Players ({filteredPlayers.length})
              </h2>
            </div>

            {loading ? (
              <p className="p-5 text-zinc-400">
                Loading players...
              </p>
            ) : filteredPlayers.length === 0 ? (
              <p className="p-5 text-zinc-400">
                No players found.
              </p>
            ) : (
              <div className="max-h-[650px] overflow-y-auto">
                {filteredPlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => selectPlayer(player)}
                    disabled={saving}
                    className={`flex w-full items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 text-left transition hover:bg-zinc-800 disabled:opacity-60 ${
                      selectedId === player.id
                        ? "bg-blue-600/20"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {player.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-400">
                        {player.dupr_id
                          ? `DUPR ID: ${player.dupr_id}`
                          : "Missing DUPR ID"}
                      </p>
                    </div>

                    <span className="shrink-0 font-bold text-blue-300">
                      {Number(player.dupr) > 0
                        ? Number(player.dupr).toFixed(2)
                        : "Unrated"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="self-start rounded-2xl border border-zinc-800 bg-zinc-900 p-5 lg:sticky lg:top-6">
            <h2 className="text-xl font-bold text-white">
              Edit Player
            </h2>

            {!selectedPlayer ? (
              <p className="mt-4 text-sm text-zinc-400">
                Select a player from the list to edit their information.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="player-name"
                    className="mb-2 block text-sm font-semibold text-zinc-300"
                  >
                    Player Name
                  </label>
                  <input
                    id="player-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    disabled={saving}
                    className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="player-dupr"
                    className="mb-2 block text-sm font-semibold text-zinc-300"
                  >
                    DUPR Rating
                  </label>
                  <input
                    id="player-dupr"
                    type="number"
                    min="0"
                    max="8"
                    step="0.01"
                    value={form.dupr}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dupr: event.target.value,
                      }))
                    }
                    disabled={saving}
                    className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="player-dupr-id"
                    className="mb-2 block text-sm font-semibold text-zinc-300"
                  >
                    DUPR ID
                  </label>
                  <input
                    id="player-dupr-id"
                    value={form.duprId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        duprId: event.target.value,
                      }))
                    }
                    placeholder="Enter DUPR ID"
                    disabled={saving}
                    className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void savePlayer()}
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="rounded-xl border border-zinc-700 px-5 py-3 text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-xs leading-relaxed text-zinc-500">
                  Changes update the saved player record.
                  Existing match scores are not modified.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
