
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type WristbandColor = {
  id: number;
  name: string;
  hex_color: string;
  is_active: boolean;
};

const inputStyle =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-yellow-400";

function validHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export default function WristbandColorsPage() {
  const [colors, setColors] = useState<WristbandColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#22C55E");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editHex, setEditHex] = useState("");

  const [showInactive, setShowInactive] = useState(true);

  const loadColors = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/facility-wristband-colors",
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load wristband colors"
        );
      }

      setColors(result.colors ?? []);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load wristband colors"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadColors();
  }, [loadColors]);

  async function addColor() {
    const name = newName.trim();

    if (!name || name.length > 50 || !validHex(newHex)) {
      setError("Enter a valid color name and hex color.");
      return;
    }

    setAdding(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/facility-wristband-colors",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            hex_color: newHex,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to add color"
        );
      }

      setNewName("");
      setNewHex("#22C55E");
      await loadColors();
      setMessage(`${name} added successfully.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to add color"
      );
    } finally {
      setAdding(false);
    }
  }

  async function updateColor(
    id: number,
    changes: {
      name?: string;
      hex_color?: string;
      is_active?: boolean;
    }
  ) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/facility-wristband-colors",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            ...changes,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to update color"
        );
      }

      await loadColors();
      setEditingId(null);
      setMessage("Wristband color updated successfully.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update color"
      );
    } finally {
      setBusyId(null);
    }
  }

  function startEditing(color: WristbandColor) {
    setEditingId(color.id);
    setEditName(color.name);
    setEditHex(color.hex_color);
    setError("");
    setMessage("");
  }

  function saveEdit() {
    if (editingId === null) return;

    const name = editName.trim();

    if (!name || name.length > 50 || !validHex(editHex)) {
      setError("Enter a valid name and hex color.");
      return;
    }

    void updateColor(editingId, {
      name,
      hex_color: editHex,
    });
  }

  const activeCount = colors.filter(
    (color) => color.is_active
  ).length;

  const visibleColors = colors.filter(
    (color) => showInactive || color.is_active
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link
            href="/admin/facility-schedule"
            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            ← Back to Daily Schedule
          </Link>

          <h1 className="mt-5 text-3xl font-black text-yellow-400">
            Wristband Color Manager
          </h1>

          <p className="mt-2 text-zinc-400">
            Manage facility-wide wristband colors for
            Pickleball Kingdom Lynnwood.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Total Colors
            </p>
            <p className="mt-2 text-3xl font-black">
              {colors.length}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Active Colors
            </p>
            <p className="mt-2 text-3xl font-black text-green-400">
              {activeCount}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Inactive Colors
            </p>
            <p className="mt-2 text-3xl font-black text-zinc-400">
              {colors.length - activeCount}
            </p>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-700 bg-red-950 p-4 text-red-200"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-xl border border-green-700 bg-green-950 p-4 text-green-200"
          >
            {message}
          </div>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold">
            Add a Custom Color
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            New colors will be available to staff across
            the facility.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_100px]">
            <label className="text-sm font-semibold">
              Color Name
              <input
                value={newName}
                onChange={(event) =>
                  setNewName(event.target.value)
                }
                placeholder="Example: Neon Orange"
                maxLength={50}
                className={`${inputStyle} mt-2`}
              />
            </label>

            <label className="text-sm font-semibold">
              Hex Color
              <input
                value={newHex}
                onChange={(event) =>
                  setNewHex(event.target.value)
                }
                placeholder="#FF6600"
                className={`${inputStyle} mt-2`}
              />
            </label>

            <label className="text-sm font-semibold">
              Preview
              <div
                className="mt-2 h-11 rounded-lg border border-zinc-600"
                style={{
                  backgroundColor: validHex(newHex)
                    ? newHex
                    : "#27272a",
                }}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={addColor}
            disabled={adding || !newName.trim() || !validHex(newHex)}
            className="mt-5 rounded-lg bg-yellow-400 px-5 py-3 font-black text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? "Adding..." : "+ Add Color"}
          </button>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                Facility Wristband Colors
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                Deactivate colors that are temporarily unavailable.
                You can reactivate them later.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) =>
                  setShowInactive(event.target.checked)
                }
                className="h-4 w-4 accent-yellow-400"
              />
              Show inactive
            </label>
          </div>

          {loading ? (
            <p className="mt-6 text-zinc-400">
              Loading colors...
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {visibleColors.map((color) => {
                const isEditing = editingId === color.id;
                const isBusy = busyId === color.id;

                return (
                  <div
                    key={color.id}
                    className={`rounded-xl border p-4 ${
                      color.is_active
                        ? "border-zinc-700 bg-zinc-950"
                        : "border-zinc-800 bg-zinc-950/60 opacity-70"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-[1fr_180px_60px]">
                          <input
                            aria-label="Edit color name"
                            value={editName}
                            onChange={(event) =>
                              setEditName(event.target.value)
                            }
                            maxLength={50}
                            className={inputStyle}
                          />

                          <input
                            aria-label="Edit hex color"
                            value={editHex}
                            onChange={(event) =>
                              setEditHex(event.target.value)
                            }
                            className={inputStyle}
                          />

                          <div
                            className="h-11 rounded-lg border border-zinc-600"
                            style={{
                              backgroundColor: validHex(editHex)
                                ? editHex
                                : "#27272a",
                            }}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={isBusy}
                            className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black disabled:opacity-50"
                          >
                            {isBusy ? "Saving..." : "Save"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={isBusy}
                            className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className="h-11 w-11 shrink-0 rounded-full border-2 border-zinc-500"
                            style={{
                              backgroundColor: color.hex_color,
                            }}
                          />

                          <div>
                            <p className="font-bold">
                              {color.name}
                            </p>

                            <p className="text-xs text-zinc-400">
                              {color.hex_color} ·{" "}
                              {color.is_active
                                ? "Active"
                                : "Inactive"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(color)}
                            disabled={busyId !== null}
                            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateColor(color.id, {
                                is_active: !color.is_active,
                              })
                            }
                            disabled={busyId !== null}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                              color.is_active
                                ? "border-red-900 text-red-300 hover:bg-red-950"
                                : "border-green-800 text-green-300 hover:bg-green-950"
                            }`}
                          >
                            {isBusy
                              ? "Updating..."
                              : color.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
