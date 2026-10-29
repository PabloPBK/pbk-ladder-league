
"use client";

import { useState, type ChangeEvent } from "react";

type CSVGuest = {
  row: number;
  name: string;
  email: string;
  phone: string;
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
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);

  if (quoted) throw new Error("CSV contains an unclosed quote.");

  return rows;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function PB101CSVImport() {
  const [fileName, setFileName] = useState("");
  const [guests, setGuests] = useState<CSVGuest[]>([]);
  const [error, setError] = useState("");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setGuests([]);
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
        throw new Error("The CSV has no guest records.");
      }

      const headers = rows[0].map(normalizeHeader);

      function column(...names: string[]) {
        return headers.findIndex((header) =>
          names.some((name) => header === normalizeHeader(name))
        );
      }

      const nameIndex = column("Full Name", "Name");
      const emailIndex = column("Email", "Email Address");
      const phoneIndex = column("Phone Number", "Phone");
      const statusIndex = column(
        "Invitation Status",
        "Registration Status",
        "Status"
      );

      if (nameIndex < 0 || emailIndex < 0 || statusIndex < 0) {
        throw new Error(
          "Missing required columns: Full Name, Email, or Invitation Status."
        );
      }

      const seenEmails = new Set<string>();

      const parsed: CSVGuest[] = rows.slice(1).map((row, index) => {
        const name = row[nameIndex]?.trim() ?? "";
        const email = (row[emailIndex] ?? "").trim().toLowerCase();
        const phone =
          phoneIndex >= 0 ? row[phoneIndex]?.trim() ?? "" : "";
        const status = (row[statusIndex] ?? "").trim().toUpperCase();

        let reason = "";

        if (status !== "CHECKED_IN") {
          reason = `Skipped: ${status || "missing status"}`;
        } else if (!name || !email) {
          reason = "Missing name or email";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          reason = "Invalid email";
        } else if (!name.includes(" ")) {
          reason = "Name needs review";
        } else if (seenEmails.has(email)) {
          reason = "Duplicate email in CSV";
        }

        if (email && status === "CHECKED_IN") {
          seenEmails.add(email);
        }

        return {
          row: index + 2,
          name,
          email,
          phone,
          status,
          eligible: reason === "",
          reason,
        };
      });

      setGuests(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to read CSV."
      );
    }
  }

  const eligible = guests.filter((guest) => guest.eligible);
  const skipped = guests.filter((guest) => !guest.eligible);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-xl font-bold text-yellow-400">
        Import Guests from PodPlay
      </h2>

      <p className="mt-2 text-sm text-zinc-400">
        Upload a PodPlay CSV export. Only CHECKED_IN guests
        will qualify for import. This preview does not save records.
      </p>

      <div className="mt-5">
        <label
          htmlFor="pb101_csv"
          className="mb-2 block text-sm font-semibold text-zinc-300"
        >
          Select CSV File
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
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {guests.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-zinc-300">
            File: <strong>{fileName}</strong>
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Total Rows", count: guests.length },
              { label: "Eligible", count: eligible.length },
              { label: "Skipped / Review", count: skipped.length },
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
                  <th className="px-3 py-3">Guest</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Import Result</th>
                </tr>
              </thead>

              <tbody>
                {guests.map((guest) => (
                  <tr
                    key={guest.row}
                    className="border-b border-zinc-800"
                  >
                    <td className="px-3 py-3">{guest.row}</td>
                    <td className="px-3 py-3">{guest.name}</td>
                    <td className="px-3 py-3">{guest.email}</td>
                    <td className="px-3 py-3">{guest.status}</td>
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
            Preview only. No guest records have been imported.
            Existing database duplicates will be checked before
            we enable saving.
          </p>
        </div>
      )}
    </section>
  );
}
