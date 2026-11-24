export const PB101_DATE_INPUT_HINT =
  "Use MM/DD/YYYY or eight digits, for example 11/24/2026 or 11242026.";

export function parsePB101Date(input: FormDataEntryValue | null) {
  if (typeof input !== "string") return null;

  const text = input.trim();
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
    ?? /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  const value = parts
    ? `${parts[3]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
    : text;

  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
