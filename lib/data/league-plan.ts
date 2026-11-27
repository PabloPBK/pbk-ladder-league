import { isUuid } from "../../zz2-site/lib/league-contract";

export function readLeaguePlan(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Enter a league name and at least one season.");
  const { planId, name, description, seasons } = input as Record<string, unknown>;
  if (typeof planId !== "string" || !isUuid(planId)) throw new Error("Invalid league plan. Reload and try again.");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 180) throw new Error("Enter a league name up to 180 characters.");
  if (typeof description !== "string" || description.trim().length > 1000) throw new Error("Enter a description up to 1,000 characters.");
  if (!Array.isArray(seasons) || !seasons.length) throw new Error("Add at least one season.");

  const dates = seasons.map((season, i) => {
    if (!Array.isArray(season)) throw new Error(`Season ${i + 1} has an invalid schedule.`);
    const values = season.filter((value) => value !== "");
    if (values.some((value) => typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value.startsWith("0000-") || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
      throw new Error(`Choose valid session dates for Season ${i + 1}.`);
    }
    return [...values].sort() as string[];
  });
  return { planId, name: name.trim(), description: description.trim() || null, dates };
}
