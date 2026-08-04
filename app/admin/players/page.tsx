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
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

export default function AdminPlayersPage() {
  const {
    players,
    setPlayers,
    reloadPlayers,
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

  const selectedRows = useMemo(
    () => rosterRows.filter((row) => row.selected),
    [rosterRows],
  );

  const selectedInvalidCount = useMemo(
    () =>
      selectedRows.filter(
        (row) => !parseDupr(row.duprText),
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
              row[DOUBLES_RATING] === "Not Rated"
                ? ""
                : row[DOUBLES_RATING] ?? "",
            selected:
              Boolean(name) &&
              status.toUpperCase() === "ACCEPTED" &&
              !waitlisted,
          } satisfies ImportedRosterRow;
        })
        .filter((row) => row.name);

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
          dupr: Number(row.duprText),
        })),
        updateExisting,
      });

      await reloadPlayers();

      window.setTimeout(() => {
        setPlayers((currentPlayers) =>
          currentPlayers.map((player) => ({
            ...player,
            checkedIn: selectedNames.has(
              normalizeName(player.name),
            ),
          })),
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

  async function handleAddWalkIn() {
    const name = walkInName
      .trim()
      .replace(/\s+/g, " ");
    const dupr = Number(walkInDupr);

    if (!name) {
      setErrorMessage("Enter the walk-in's name.");
      return;
    }

    if (!Number.isFinite(dupr) || dupr <= 0) {
      setErrorMessage(
        "Enter a valid DUPR for the walk-in.",
      );
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
                    {selectedRows.length} selected · {waitlistCount} waitlisted · {selectedInvalidCount} selected without a valid DUPR
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
              <table className="w-full min-w-[820px]">
                <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-center">
                      Playing
                    </th>
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
                    const validDupr = Boolean(
                      parseDupr(row.duprText),
                    );

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
                            min="0.01"
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
                            placeholder="Required"
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
                        colSpan={5}
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
              min="0.01"
              max="8"
              step="0.01"
              value={walkInDupr}
              onChange={(event) =>
                setWalkInDupr(event.target.value)
              }
              placeholder="DUPR"
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
          <h2 className="text-xl font-bold text-white">
            Current Player Database
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {players.length} players currently available in the league manager.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}