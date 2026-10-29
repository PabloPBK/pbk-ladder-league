
"use client";

import { useState, type ChangeEvent } from "react";
import { importPB101Guests } from "./import-actions";

type CSVGuest = {
  row: number;
  name: string;
  email: string;
  phone: string;
  invitationType: string;
  status: string;
  eligible: boolean;
  reason: string;
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !quoted
    ) {
      if (char === "\r" && input[i + 1] === "\n") {
        i++;
      }

      row.push(field.trim());

      if (row.some((value) => value !== "")) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());

  if (row.some((value) => value !== "")) {
    rows.push(row);
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quote.");
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function PB101CSVImport() {
  const [fileName, setFileName] = useState("");
  const [guests, setGuests] = useState<CSVGuest[]>([]);
  const [coaches, setCoaches] = useState<string[]>([]);
  const [selectedCoach, setSelectedCoach] = useState("");
  const [classDate, setClassDate] = useState("");

  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importCompleted, setImportCompleted] = useState(false);

  function resetImportResult() {
    setImportMessage("");
    setImportErrors([]);
    setImportCompleted(false);
  }

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setError("");
    setGuests([]);
    setCoaches([]);
    setSelectedCoach("");
    setClassDate("");
    setFileName("");
    resetImportResult();

    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Please upload a CSV smaller than 2 MB.");
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length < 2) {
        throw new Error("The CSV has no records.");
      }

      const headers = rows[0].map(normalizeHeader);

      function column(...names: string[]) {
        return headers.findIndex((header) =>
          names.some(
            (name) => header === normalizeHeader(name)
          )
        );
      }

      const nameIndex = column("Full Name", "Name");
      const emailIndex = column(
        "Email",
        "Email Address"
      );
      const phoneIndex = column(
        "Phone Number",
        "Phone"
      );
      const statusIndex = column(
        "Invitation Status",
        "Registration Status",
        "Status"
      );
      const typeIndex = column("Invitation Type");

      if (
        nameIndex < 0 ||
        emailIndex < 0 ||
        statusIndex < 0 ||
        typeIndex < 0
      ) {
        throw new Error(
          "Missing required columns: Full Name, Email, Invitation Status, or Invitation Type."
        );
      }

      const detectedCoaches = Array.from(
        new Set(
          rows
            .slice(1)
            .filter(
              (row) =>
                (row[typeIndex] ?? "")
                  .trim()
                  .toUpperCase() === "COACH"
            )
            .map((row) =>
              (row[nameIndex] ?? "").trim()
            )
            .filter(Boolean)
        )
      );

      setCoaches(detectedCoaches);

      const defaultCoach =
        detectedCoaches.length === 1
          ? detectedCoaches[0]
          : "";

      setSelectedCoach(defaultCoach);

      const seenEmails = new Set<string>();

      const parsed: CSVGuest[] = rows
        .slice(1)
        .map((row, index) => {
          const name =
            (row[nameIndex] ?? "").trim();

          const email =
            (row[emailIndex] ?? "")
              .trim()
              .toLowerCase();

          const phone =
            phoneIndex >= 0
              ? (row[phoneIndex] ?? "").trim()
              : "";

          const status =
            (row[statusIndex] ?? "")
              .trim()
              .toUpperCase();

          const invitationType =
            (row[typeIndex] ?? "")
              .trim()
              .toUpperCase();

          let reason = "";

          if (invitationType === "COACH") {
            reason = "Coach - excluded from guest roster";
          } else if (
            invitationType !== "EVENT_SIGNUP"
          ) {
            reason = `Skipped invitation type: ${
              invitationType || "missing"
            }`;
          } else if (status !== "CHECKED_IN") {
            reason = `Skipped: ${
              status || "missing status"
            }`;
          } else if (!name || !email) {
            reason = "Missing name or email";
          } else if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              email
            )
          ) {
            reason = "Invalid email";
          } else if (!name.includes(" ")) {
            reason = "Name needs review";
          } else if (seenEmails.has(email)) {
            reason = "Duplicate email in CSV";
          }

          if (
            invitationType === "EVENT_SIGNUP" &&
            status === "CHECKED_IN" &&
            email
          ) {
            seenEmails.add(email);
          }

          return {
            row: index + 2,
            name,
            email,
            phone,
            invitationType,
            status,
            eligible: reason === "",
            reason,
          };
        });

      setGuests(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to read CSV."
      );
    }
  }

  const eligible = guests.filter(
    (guest) => guest.eligible
  );

  const skipped = guests.filter(
    (guest) => !guest.eligible
  );

  const coachRows = guests.filter(
    (guest) => guest.invitationType === "COACH"
  );

  async function handleImport() {
    if (importing || importCompleted) return;

    if (!classDate || !selectedCoach) {
      setImportMessage(
        "Please select the PB101 class date and coach."
      );
      return;
    }

    if (eligible.length === 0) {
      setImportMessage("No eligible guests to import.");
      return;
    }

    const confirmed = window.confirm(
      `Import ${eligible.length} checked-in guest(s) ` +
        `from ${classDate}, assigned to ${selectedCoach}?`
    );

    if (!confirmed) return;

    setImporting(true);
    setImportMessage("");
    setImportErrors([]);

    try {
      const result = await importPB101Guests({
        fileName,
        classDate,
        coach: selectedCoach,
        guests: guests.map((guest) => ({
          name: guest.name,
          email: guest.email,
          phone: guest.phone,
          invitationType: guest.invitationType,
          status: guest.status,
        })),
      });

      setImportMessage(result.message);
      setImportErrors(result.errors);

      if (result.imported > 0 || result.success) {
        setImportCompleted(true);
      }
    } catch {
      setImportMessage(
        "Import failed. Please try again or contact an administrator."
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-xl font-bold text-yellow-400">
        Import Guests from PodPlay
      </h2>

      <p className="mt-2 text-sm text-zinc-400">
        Only EVENT_SIGNUP guests marked CHECKED_IN
        qualify for import. Coaches are identified
        separately and excluded from the guest roster.
      </p>

      <div className="mt-5">
        <label
          htmlFor="pb101_csv"
          className="mb-2 block text-sm font-semibold text-zinc-300"
        >
          Select PodPlay CSV File
        </label>

        <input
          id="pb101_csv"
          type="file"
          accept=".csv,text/csv"
          disabled={importing}
          onChange={handleFile}
          className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-white"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 text-sm text-red-400"
        >
          {error}
        </p>
      )}

      {guests.length > 0 && (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-zinc-300">
            File: <strong>{fileName}</strong>
          </p>

          <div className="rounded-xl border border-blue-800 bg-blue-950/30 p-4">
            <h3 className="font-bold text-yellow-400">
              PB101 Class Coach
            </h3>

            {coaches.length === 0 ? (
              <p className="mt-2 text-sm text-amber-300">
                No coach was identified in this file.
                A coach must be assigned before importing.
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-300">
                Detected coach
                {coaches.length > 1 ? "es" : ""}:{" "}
                {coaches.join(", ")}
              </p>
            )}

            <label
              htmlFor="import_coach"
              className="mt-4 block text-sm font-semibold text-zinc-300"
            >
              Assign Coach to Imported Guests
            </label>

            <select
              id="import_coach"
              value={selectedCoach}
              disabled={importing || importCompleted}
              onChange={(event) => {
                setSelectedCoach(event.target.value);
                resetImportResult();
              }}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            >
              <option value="">Select coach</option>

              {coaches.map((coach) => (
                <option key={coach} value={coach}>
                  {coach}
                </option>
              ))}
            </select>

            {coaches.length > 1 && (
              <p className="mt-2 text-xs text-amber-300">
                Multiple coaches were found. Select the
                appropriate coach for this group.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <h3 className="font-bold text-yellow-400">
              PB101 Class Completion Date
            </h3>

            <p className="mt-2 text-sm text-zinc-400">
              Select the actual date these guests completed
              PB101. Their seven-day trial will begin on
              this date, regardless of when the CSV is uploaded.
            </p>

            <label
              htmlFor="pb101_class_date"
              className="mt-4 block text-sm font-semibold text-zinc-300"
            >
              Class Date (Required)
            </label>

            <input
              id="pb101_class_date"
              type="date"
              required
              value={classDate}
              disabled={importing || importCompleted}
              onChange={(event) => {
                setClassDate(event.target.value);
                resetImportResult();
              }}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            />

            {classDate ? (
              <p className="mt-3 text-sm text-green-400">
                Selected class date: {classDate}
              </p>
            ) : (
              <p className="mt-3 text-xs text-amber-400">
                A class date is required before importing.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Total CSV Rows",
                count: guests.length,
              },
              {
                label: "Eligible Guests",
                count: eligible.length,
              },
              {
                label: "Excluded / Review",
                count: skipped.length,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-zinc-800 p-4"
              >
                <p className="text-xs text-zinc-400">
                  {item.label}
                </p>

                <p className="mt-1 text-2xl font-black text-white">
                  {item.count}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-700 text-zinc-400">
                <tr>
                  <th className="px-3 py-3">Row</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Coach</th>
                  <th className="px-3 py-3">Result</th>
                </tr>
              </thead>

              <tbody>
                {guests.map((guest) => (
                  <tr
                    key={guest.row}
                    className="border-b border-zinc-800"
                  >
                    <td className="px-3 py-3">
                      {guest.row}
                    </td>

                    <td className="px-3 py-3">
                      {guest.name}
                    </td>

                    <td className="px-3 py-3">
                      {guest.invitationType}
                    </td>

                    <td className="px-3 py-3">
                      {guest.status}
                    </td>

                    <td className="px-3 py-3">
                      {guest.eligible
                        ? selectedCoach || "Not assigned"
                        : "-"}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={
                          guest.eligible
                            ? "text-green-400"
                            : "text-amber-400"
                        }
                      >
                        {guest.eligible
                          ? "Eligible"
                          : guest.reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <h3 className="font-bold text-yellow-400">
              Confirm Guest Import
            </h3>

            <p className="mt-2 text-sm text-zinc-300">
              {eligible.length} eligible guest(s) will be
              submitted. Existing database guests will be
              skipped. No automated emails will be sent.
            </p>

            <button
              type="button"
              onClick={handleImport}
              disabled={
                importing ||
                importCompleted ||
                eligible.length === 0 ||
                !classDate ||
                !selectedCoach
              }
              className="mt-4 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importing
                ? "Importing..."
                : importCompleted
                  ? "Import Completed"
                  : `Import ${eligible.length} Guest(s)`}
            </button>

            {importMessage && (
              <p
                role="status"
                className="mt-3 text-sm text-white"
              >
                {importMessage}
              </p>
            )}

            {importErrors.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-400">
                {importErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            Coach records detected: {coachRows.length}.
            Coaches are excluded from the guest roster.
          </p>
        </div>
      )}
    </section>
  );
}
