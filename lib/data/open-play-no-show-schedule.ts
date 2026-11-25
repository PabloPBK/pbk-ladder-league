export const scheduleHistoryDays = 3;

export function recentOpenPlayDates(today: string) {
  return Array.from({ length: scheduleHistoryDays }, (_, index) => {
    const date = new Date(today + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - index - 1);
    return date.toISOString().slice(0, 10);
  });
}

export type ScheduledOpenPlay = { name: string; start: string; end: string };

const clock = /^([01]\d|2[0-3]):[0-5]\d$/;

export function scheduledOpenPlays(snapshot: unknown) {
  if (!Array.isArray(snapshot)) return [];
  const sessions = new Map<string, ScheduledOpenPlay>();
  for (const event of snapshot) {
    const { start, end, levels } = event ?? {};
    if (typeof start !== "string" || typeof end !== "string" || !clock.test(start) || !clock.test(end) || start >= end) continue;

    const names = Array.isArray(levels) ? levels.filter((level): level is string =>
      typeof level === "string" && !!level.trim()) : [];
    for (const level of names.length ? names : [""]) {
      const cleaned = level.trim();
      const name = (cleaned ? `${cleaned} · Open Play` : "Open Play").slice(0, 160);
      sessions.set(JSON.stringify([start, end, name]), { name, start, end });
    }
  }
  return [...sessions.values()].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}
