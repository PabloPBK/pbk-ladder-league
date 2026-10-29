
"use client";

import { useState, type ChangeEvent } from "react";

type CSVGuest = {
  row: number;
  name: string;
  email: string;
  phone: string;
  invitationType: string;
  status: string;
  coach: string;
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
  const [error, setError] = useState("");

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setError("");
    setGuests([]);
    setCoaches([]);
    setSelectedCoach("");
    setFileName("");

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
            (name) =>
              header === normalizeHeader(name)
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

      // Identify coaches separately from guests.
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

      // Automatically select a coach only when
      // the CSV identifies exactly one.
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
            reason = "Coach — excluded from guest roster";
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
            coach: defaultCoach,
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
                Staff must assign one before importing.
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
              onChange={(event) =>
                setSelectedCoach(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            >
              <option value="">
                Select coach
              </option>

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
                Individual assignments can be added later.
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
                        : "—"}
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

          <p className="text-xs text-zinc-500">
            Preview only. No records are saved.
            Coaches are excluded from the guest roster.
            Existing database duplicates will be checked
            before actual importing is enabled.
          </p>

          <p className="text-xs text-zinc-500">
            Coach records detected: {coachRows.length}
          </p>
        </div>
      )}
    </section>
  );
}
