const pacificDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
const pacificTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
});
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function noShowToday() {
  const parts = pacificDate.formatToParts(new Date());
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

export function noShowMoney(cents: number) {
  return currency.format(cents / 100);
}

export function parseNoShowAmount(value: string) {
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value) * 100);
  return cents >= 1 && cents <= 1_000_000 ? cents : null;
}

export type NoShowReportEvent = {
  session_date: string;
  session_time: string;
  session_name: string;
  player_name: string;
  recorded_at: string;
  staff_name: string;
  notes: string | null;
  event: "Charge" | "Refund" | "Exception";
  amount_cents: number | null;
  reason: string | null;
};

function csvRow(cells: (string | number | null)[]) {
  return cells.map((cell) => {
    if (typeof cell === "number") return String(cell);
    if (cell === null) return "";
    const text = /^[\t\r\n]|^\s*[=+@-]/.test(cell) ? "'" + cell : cell;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(",");
}

export function noShowDailyCsv(date: string, events: NoShowReportEvent[]) {
  const charges = events.filter(({ event }) => event === "Charge");
  const refunds = events.filter(({ event }) => event === "Refund");
  const chargeCents = charges.reduce((total, { amount_cents }) => total + (amount_cents ?? 0), 0);
  const refundCents = refunds.reduce((total, { amount_cents }) => total + (amount_cents ?? 0), 0);
  const rows = [
    ["Lynnwood open-play no-shows", date, "Pacific time"],
    ["Charges", "Refunds", "Exceptions", "Known gross (USD)", "Refunded (USD)", "Known net (USD)", "Charges with no amount recorded"],
    [charges.length, refunds.length, events.length - charges.length - refunds.length,
      chargeCents / 100, refundCents / 100, (chargeCents - refundCents) / 100,
      charges.filter(({ amount_cents }) => amount_cents === null).length],
    [],
    ["Action", "Recorded (Pacific time)", "Player", "Session date", "Session time", "Session", "Amount (USD)", "Staff", "Reason", "Current notes"],
    ...events.map((entry) => [
      entry.event, pacificTime.format(new Date(entry.recorded_at)), entry.player_name, entry.session_date,
      entry.session_time, entry.session_name, entry.amount_cents === null ? null : entry.amount_cents / 100,
      entry.staff_name, entry.reason, entry.notes,
    ]),
  ];
  return "\uFEFF" + rows.map(csvRow).join("\r\n") + "\r\n";
}
