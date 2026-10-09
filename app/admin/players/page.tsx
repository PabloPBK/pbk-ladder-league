"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { useLeague } from "../../../components/providers/LeagueProvider";
import { importPlayers } from "@/lib/data/playerImport";

type ImportedRosterRow = {
  rowId: number;
  name: string;
  email: string;
  phone: string;
  invitationStatus: string;
  waitlistEnrollmentTime: string;
  duprText: string;
  selected: boolean;
};

type ParsedCsvRow = Record<string, string>;

const FULL_NAME = "Full Name";
const EMAIL = "Email";
const PHONE = "Phone Number";
const INVITATION_STATUS = "Invitation Status";
const WAITLIST_TIME = "Waitlist Enrollment Time";
const DOUBLES_RATING = "Ratings Doubles";
const RATING_HEADERS = ["Ratings Doubles", "DUPR Doubles", "DUPR Doubles Rating", "Doubles Rating", "DUPR Rating", "DUPR", "Doubles DUPR"];
function getRosterRating(row: ParsedCsvRow): string {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const header of RATING_HEADERS) {
    const value = normalized.get(header.toLowerCase());
    if (value !== undefined) return /^(not rated|unrated|n\/a|-)$/i.test(value.trim()) ? "" : value.trim();
  }
  return "";
}

function normalizeName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

function parseCsv(text: string): ParsedCsvRow[] {
  const cleanedText = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < cleanedText.length; index += 1) {
    const character = cleanedText[index];
    const nextCharacter = cleanedText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (character === "\n" || character === "\r") &&
      !insideQuotes
    ) {
      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {
        index += 1;
      }

      row.push(cell);
      cell = "";

      if (row.some((value) => value.trim())) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += character;
  }

  row.push(cell);

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;

  if (!headers) {
    return [];
  }

  return dataRows.map((values) =>
    headers.reduce<ParsedCsvRow>(
      (record, header, columnIndex) => {
        record[header.trim()] =
          values[columnIndex]?.trim() ?? "";
        return record;
      },
      {},
    ),
  );
}

function isWaitlisted(row: ParsedCsvRow) {
  const status =
    row[INVITATION_STATUS]?.toUpperCase() ?? "";
  const waitlistTime =
    row[WAITLIST_TIME]?.trim() ?? "";

  return (
    status.includes("WAITLIST") ||
    Boolean(waitlistTime)
  );
}

function parseDupr(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 8 ? parsed : null;
}

export default function AdminPlayersPage() {
  const {
    players,
    setPlayers,
    reloadPlayers,
    playerDatabaseIds,
  } = useLeague();

  const [fileName, setFileName] = useState("");
  const [rosterRows, setRosterRows] = useState<
    ImportedRosterRow[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "confirmed" | "waitlist"
  >("all");
  const [isDraggingFile, setIsDraggingFile] =
    useState(false);
  const [updateExisting, setUpdateExisting] =
    useState(true);
  const [isImporting, setIsImporting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [walkInName, setWalkInName] =
    useState("");
  const [walkInDupr, setWalkInDupr] =
    useState("");
  const [isAddingWalkIn, setIsAddingWalkIn] =
    useState(false);
  const [duprIdDrafts, setDuprIdDrafts] = useState<Record<number, string>>({});
  const [savingDuprPlayerId, setSavingDuprPlayerId] = useState<number | null>(null);

  const selectedRows = useMemo(
    () => rosterRows.filter((row) => row.selected),
    [rosterRows],
  );

  const selectedInvalidCount = useMemo(
    () =>
      selectedRows.filter(
        (row) => parseDupr(row.duprText) === null,
      ).length,
    [selectedRows],
  );

  const waitlistCount = useMemo(
    () =>
      rosterRows.filter((row) =>
        row.invitationStatus
          .toUpperCase()
          .includes("WAITLIST") ||
        Boolean(row.waitlistEnrollmentTime),
      ).length,
    [rosterRows],
  );

  const confirmedCount =
    rosterRows.length - waitlistCount;

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchText
      .trim()
      .toLocaleLowerCase("en-US");

    return rosterRows.filter((row) => {
      const waitlisted =
        row.invitationStatus
          .toUpperCase()
          .includes("WAITLIST") ||
        Boolean(row.waitlistEnrollmentTime);

      if (
        statusFilter === "confirmed" &&
        waitlisted
      ) {
        return false;
      }

      if (
        statusFilter === "waitlist" &&
        !waitlisted
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        row.name
          .toLocaleLowerCase("en-US")
          .includes(normalizedSearch) ||
        row.email
          .toLocaleLowerCase("en-US")
          .includes(normalizedSearch)
      );
    });
  }, [rosterRows, searchText, statusFilter]);

  async function processRosterFile(file: File) {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      const text = await file.text();
      const parsedRows = parseCsv(text);

      if (parsedRows.length === 0) {
        throw new Error(
          "The uploaded file did not contain any player rows.",
        );
      }

      const firstRow = parsedRows[0];

      if (!firstRow || !(FULL_NAME in firstRow)) {
        throw new Error(
          'The roster must include a "Full Name" column.',
        );
      }

      const mappedRows = parsedRows
        .map((row, index) => {
          const name = (row[FULL_NAME] ?? "")
            .trim()
            .replace(/\s+/g, " ");
          const waitlisted = isWaitlisted(row);
          const status =
            row[INVITATION_STATUS] ?? "";

          return {
            rowId: index + 1,
            name,
            email: row[EMAIL] ?? "",
            phone: row[PHONE] ?? "",
            invitationStatus: status,
            waitlistEnrollmentTime:
              row[WAITLIST_TIME] ?? "",
            duprText:
              getRosterRating(row),
            selected:
              Boolean(name) &&
              status.toUpperCase() === "ACCEPTED" &&
              !waitlisted,
          } satisfies ImportedRosterRow;
        })
        .filter((row) => row.name);

      mappedRows.sort((a, b) => {
        if (a.selected !== b.selected) return a.selected ? -1 : 1;
        const ratingA = parseDupr(a.duprText) ?? 0;
        const ratingB = parseDupr(b.duprText) ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return a.name.localeCompare(b.name);
      });

      if (mappedRows.every((row) => row.duprText === "")) {
        setErrorMessage("No DUPR doubles ratings were found in this CSV. Existing database ratings will be preserved; enter ratings manually or upload a CSV with a DUPR doubles rating column.");
      }
      setFileName(file.name);
      setRosterRows(mappedRows);
      setSearchText("");
      setStatusFilter("all");
    } catch (error) {
      setRosterRows([]);
      setFileName("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to read the roster file.",
      );
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await processRosterFile(file);
    event.target.value = "";
  }

  async function handleFileDrop(
    event: DragEvent<HTMLLabelElement>,
  ) {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    await processRosterFile(file);
  }

  function selectConfirmedPlayers() {
    setRosterRows((currentRows) =>
      currentRows.map((row) => {
        const waitlisted =
          row.invitationStatus
            .toUpperCase()
            .includes("WAITLIST") ||
          Boolean(row.waitlistEnrollmentTime);

        return {
          ...row,
          selected: !waitlisted,
        };
      }),
    );
  }

  function clearPlayerSelection() {
    setRosterRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        selected: false,
      })),
    );
  }

  function updateRow(
    rowId: number,
    changes: Partial<ImportedRosterRow>,
  ) {
    setRosterRows((currentRows) =>
      currentRows.map((row) =>
        row.rowId === rowId
          ? { ...row, ...changes }
          : row,
      ),
    );
  }

  function moveRosterPlayer(rowId: number, direction: "up" | "down") {
    setRosterRows((currentRows) => {
      const currentIndex = currentRows.findIndex((row) => row.rowId === rowId);
      if (currentIndex < 0 || !currentRows[currentIndex]?.selected) return currentRows;

      const selectedIndexes = currentRows
        .map((row, index) => (row.selected ? index : -1))
        .filter((index) => index >= 0);
      const selectedPosition = selectedIndexes.indexOf(currentIndex);
      const targetPosition = direction === "up" ? selectedPosition - 1 : selectedPosition + 1;
      if (targetPosition < 0 || targetPosition >= selectedIndexes.length) return currentRows;

      const targetIndex = selectedIndexes[targetPosition];
      const nextRows = [...currentRows];
      [nextRows[currentIndex], nextRows[targetIndex]] = [nextRows[targetIndex], nextRows[currentIndex]];
      return nextRows;
    });
  }

  async function handleImportSelected() {
    if (
      selectedRows.length === 0 ||
      selectedInvalidCount > 0 ||
      isImporting
    ) {
      return;
    }

    try {
      setIsImporting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const selectedNames = new Set(
        selectedRows.map((row) =>
          normalizeName(row.name),
        ),
      );

      const result = await importPlayers({
        players: selectedRows.map((row) => ({
          name: row.name,
          dupr: row.duprText.trim() === "" ? null : Number(row.duprText),
        })),
        updateExisting,
      });

      await reloadPlayers();

      const selectedOrder = new Map(
        selectedRows.map((row, index) => [normalizeName(row.name), index]),
      );

      window.setTimeout(() => {
        setPlayers((currentPlayers) =>
          currentPlayers
            .map((player) => ({
              ...player,
              checkedIn: selectedNames.has(normalizeName(player.name)),
            }))
            .sort((a, b) => {
              const orderA = selectedOrder.get(normalizeName(a.name));
              const orderB = selectedOrder.get(normalizeName(b.name));
              if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
              if (orderA !== undefined) return -1;
              if (orderB !== undefined) return 1;
              return b.dupr - a.dupr || a.name.localeCompare(b.name);
            }),
        );
      }, 0);

      setSuccessMessage(
        `${selectedRows.length} playing player${
          selectedRows.length === 1 ? "" : "s"
        } prepared. ${result.created} new, ${result.updated} updated, ${result.skipped} skipped.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to import the selected players.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function saveDuprId(playerId: number) {
    const databaseId = playerDatabaseIds[playerId];
    if (!databaseId) {
      setErrorMessage("Unable to find this player in the database.");
      return;
    }

    try {
      setSavingDuprPlayerId(playerId);
      setErrorMessage("");
      const value = duprIdDrafts[playerId] ?? players.find((player) => player.id === playerId)?.duprId ?? "";
      const response = await fetch(`/api/players/${encodeURIComponent(databaseId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duprId: value }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save DUPR ID.");
      await reloadPlayers();
      setSuccessMessage("DUPR ID saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save DUPR ID.");
    } finally {
      setSavingDuprPlayerId(null);
    }
  }

  async function handleAddWalkIn() {
    const name = walkInName
      .trim()
      .replace(/\s+/g, " ");
    const dupr = Number(walkInDupr);

    if (!name) {
      setErrorMessage("Enter the walk-in's name.");
      return;
    }

    if (!Number.isFinite(dupr) || dupr < 0 || dupr > 8) {
      setErrorMessage("Enter a rating from 0 to 8. Use 0 for an unrated walk-in.");
      return;
    }

    try {
      setIsAddingWalkIn(true);
      setErrorMessage("");
      setSuccessMessage("");

      await importPlayers({
        players: [{ name, dupr }],
        updateExisting: true,
      });

      await reloadPlayers();

      window.setTimeout(() => {
        setPlayers((currentPlayers) =>
          currentPlayers.map((player) => ({
            ...player,
            checkedIn:
              player.checkedIn ||
              normalizeName(player.name) ===
                normalizeName(name),
          })),
        );
      }, 0);

      setWalkInName("");
      setWalkInDupr("");
      setSuccessMessage(
        `${name} was added and checked in.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to add the walk-in.",
      );
    } finally {
      setIsAddingWalkIn(false);
    }
  }

  return (
    <AppLayout
      title="Weekly Roster"
      description="Import the weekly PodPlay roster, select who is playing tonight, and add walk-ins."
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-white"
          >
            ← Back to Admin
          </Link>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="flex flex-col gap-3 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-green-300 sm:flex-row sm:items-center sm:justify-between">
            <span>{successMessage}</span>

            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-bold text-white transition hover:bg-green-500"
            >
              Go to Check-In
            </Link>
          </div>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-2xl font-bold text-white">
            Import Weekly Roster
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Upload the CSV downloaded from PodPlay. Confirmed players are selected automatically, while waitlisted players remain unselected.
          </p>

          <label
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDraggingFile(false);
            }}
            onDrop={(event) =>
              void handleFileDrop(event)
            }
            className={`mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition ${
              isDraggingFile
                ? "border-blue-300 bg-blue-500/20"
                : "border-blue-500/60 bg-blue-500/10 hover:bg-blue-500/15"
            }`}
          >
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(event) =>
                void handleFileChange(event)
              }
              className="sr-only"
            />
            <span className="text-3xl" aria-hidden="true">
              📥
            </span>
            <span className="mt-2 font-bold text-blue-200">
              {fileName
                ? `Loaded: ${fileName}`
                : "Drag and drop the PodPlay CSV here"}
            </span>
            <span className="mt-1 text-sm text-zinc-400">
              or click to choose a CSV file
            </span>
          </label>
        </section>

        {rosterRows.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Players Found
              </p>
              <p className="mt-1 text-3xl font-black text-white">
                {rosterRows.length}
              </p>
            </div>

            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-300">
                Confirmed
              </p>
              <p className="mt-1 text-3xl font-black text-green-300">
                {confirmedCount}
              </p>
            </div>

            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">
                Waitlisted
              </p>
              <p className="mt-1 text-3xl font-black text-yellow-300">
                {waitlistCount}
              </p>
            </div>
          </section>
        )}

        {rosterRows.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <header className="border-b border-zinc-800 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Tonight&apos;s Players
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedRows.length} selected · {waitlistCount} waitlisted · {selectedInvalidCount} selected with an invalid rating
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(event) =>
                      setUpdateExisting(
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4"
                  />
                  Update existing DUPR
                </label>

                <button
                  type="button"
                  disabled={selectedRows.length === 0 || selectedInvalidCount > 0}
                  onClick={() => window.print()}
                  className="min-h-11 rounded-xl border border-zinc-600 px-4 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Print Court List
                </button>

                <button
                  type="button"
                  disabled={
                    selectedRows.length === 0 ||
                    selectedInvalidCount > 0 ||
                    isImporting
                  }
                  onClick={() =>
                    void handleImportSelected()
                  }
                  className="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {isImporting
                    ? "Importing..."
                    : `Import ${selectedRows.length} Selected`}
                </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) =>
                    setSearchText(event.target.value)
                  }
                  placeholder="Search player or email"
                  className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-4 outline-none focus:border-blue-500"
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as
                        | "all"
                        | "confirmed"
                        | "waitlist",
                    )
                  }
                  className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 outline-none focus:border-blue-500"
                >
                  <option value="all">All players</option>
                  <option value="confirmed">
                    Confirmed
                  </option>
                  <option value="waitlist">
                    Waitlist
                  </option>
                </select>

                <button
                  type="button"
                  onClick={selectConfirmedPlayers}
                  className="min-h-11 rounded-xl border border-green-500/40 bg-green-500/10 px-4 text-sm font-semibold text-green-300 transition hover:bg-green-500/15"
                >
                  Select Confirmed
                </button>

                <button
                  type="button"
                  onClick={clearPlayerSelection}
                  className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
                >
                  Clear Selection
                </button>
              </div>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-center">
                      Playing
                    </th>
                    <th className="px-4 py-3 text-center">Court / Order</th>
                    <th className="px-4 py-3 text-left">
                      Player
                    </th>
                    <th className="px-4 py-3 text-left">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left">
                      DUPR
                    </th>
                    <th className="px-4 py-3 text-left">
                      Email
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => {
                    const waitlisted =
                      row.invitationStatus
                        .toUpperCase()
                        .includes("WAITLIST") ||
                      Boolean(
                        row.waitlistEnrollmentTime,
                      );
                    const validDupr = parseDupr(row.duprText) !== null;

                    return (
                      <tr
                        key={row.rowId}
                        className={`border-t border-zinc-800 ${
                          row.selected
                            ? "bg-green-500/5"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(event) =>
                              updateRow(row.rowId, {
                                selected:
                                  event.target.checked,
                              })
                            }
                            className="h-5 w-5"
                            aria-label={`Select ${row.name}`}
                          />
                        </td>

                        <td className="px-4 py-3 text-center">
                          {row.selected ? (() => {
                            const position = selectedRows.findIndex((selected) => selected.rowId === row.rowId);
                            const court = Math.floor(position / 4) + 1;
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <span className="rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-300">C{court} · #{position + 1}</span>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => moveRosterPlayer(row.rowId, "up")} disabled={position <= 0} className="rounded border border-zinc-700 px-2 py-1 text-white disabled:opacity-25">↑</button>
                                  <button type="button" onClick={() => moveRosterPlayer(row.rowId, "down")} disabled={position < 0 || position >= selectedRows.length - 1} className="rounded border border-zinc-700 px-2 py-1 text-white disabled:opacity-25">↓</button>
                                </div>
                              </div>
                            );
                          })() : <span className="text-zinc-600">—</span>}
                        </td>

                        <td className="px-4 py-3 font-semibold text-white">
                          {row.name}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              waitlisted
                                ? "bg-yellow-500/15 text-yellow-300"
                                : "bg-green-500/15 text-green-300"
                            }`}
                          >
                            {waitlisted
                              ? "Waitlist"
                              : row.invitationStatus ||
                                "Imported"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="8"
                            step="0.01"
                            value={row.duprText}
                            onChange={(event) =>
                              updateRow(row.rowId, {
                                duprText:
                                  event.target.value,
                              })
                            }
                            className={`w-28 rounded-lg border bg-zinc-950 px-3 py-2 outline-none ${
                              validDupr
                                ? "border-zinc-700 focus:border-blue-500"
                                : row.selected
                                  ? "border-red-500"
                                  : "border-zinc-700"
                            }`}
                            placeholder="0 = unrated"
                          />
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {row.email || "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-zinc-400"
                      >
                        No players match the current search or filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {rosterRows.length > 0 && (
          <section className="court-assignment-print hidden print:block">
            <h1>PBK Ladder League — Court Assignments</h1>
            <p>{selectedRows.length} players • {Math.ceil(selectedRows.length / 4)} courts (last court may be incomplete)</p>
            <div className="print-court-grid">
              {Array.from({ length: Math.ceil(selectedRows.length / 4) }, (_, courtIndex) => {
                const courtPlayers = selectedRows.slice(courtIndex * 4, courtIndex * 4 + 4);
                return (
                  <div key={courtIndex} className="print-court-card">
                    <h2>Court {courtIndex + 1}</h2>
                    <ol>
                      {courtPlayers.map((player) => (
                        <li key={player.rowId}>
                          <strong>{player.name}</strong>
                          <span>{(parseDupr(player.duprText) ?? 0) > 0 ? Number(player.duprText).toFixed(2) : "Unrated"}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-2xl font-bold text-white">
            Add Walk-In Player
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Existing players are updated; new players are created and checked in.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
            <input
              type="text"
              value={walkInName}
              onChange={(event) =>
                setWalkInName(event.target.value)
              }
              placeholder="Player name"
              className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-950 px-4 outline-none focus:border-blue-500"
            />

            <input
              type="number"
              min="0"
              max="8"
              step="0.01"
              value={walkInDupr}
              onChange={(event) =>
                setWalkInDupr(event.target.value)
              }
              placeholder="DUPR (0 if unrated)"
              className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-950 px-4 outline-none focus:border-blue-500"
            />

            <button
              type="button"
              disabled={isAddingWalkIn}
              onClick={() =>
                void handleAddWalkIn()
              }
              className="min-h-12 rounded-xl bg-green-600 px-6 font-bold text-white transition hover:bg-green-500 disabled:bg-zinc-700"
            >
              {isAddingWalkIn
                ? "Adding..."
                : "Add & Check In"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-bold text-white">DUPR Player IDs</h2>
          <p className="mt-1 text-sm text-zinc-400">Save each player&apos;s DUPR ID once. Completed league nights can then be exported directly into the DUPR match-upload template.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {players.map((player) => {
              const draft = duprIdDrafts[player.id] ?? player.duprId ?? "";
              return (
                <div key={player.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{player.name}</p>
                      <p className="text-xs text-zinc-500">Rating {player.dupr > 0 ? player.dupr.toFixed(2) : "Unrated"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${draft ? "bg-green-500/15 text-green-300" : "bg-yellow-500/15 text-yellow-300"}`}>{draft ? "ID saved" : "Missing ID"}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input value={draft} onChange={(event) => setDuprIdDrafts((current) => ({ ...current, [player.id]: event.target.value }))} placeholder="DUPR ID" className="min-h-10 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-white" />
                    <button type="button" disabled={savingDuprPlayerId === player.id} onClick={() => void saveDuprId(player.id)} className="rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:bg-zinc-700">{savingDuprPlayerId === player.id ? "Saving..." : "Save"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}