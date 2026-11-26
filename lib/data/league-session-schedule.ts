import type { LeagueEventRecord } from "./events";

type Registration = { date: string; start_time: string };
type ScheduledDate = { event_date: string; session_number: number };

export type LeagueSessionOption = {
  key: string;
  date: string;
  number: number;
  startTime?: string;
  event?: LeagueEventRecord;
};

export function buildLeagueSessionOptions(
  events: LeagueEventRecord[],
  published: Registration[],
  scheduled: ScheduledDate[],
): LeagueSessionOption[] {
  const dates = new Set([
    ...events.map(({ event_date }) => event_date),
    ...published.map(({ date }) => date),
    ...scheduled.map(({ event_date }) => event_date),
  ]);

  let ordinal = 1;
  return [...dates].sort().flatMap((date) => {
    const recorded = events.filter(({ event_date }) => event_date === date)
      .sort((a, b) => a.session_number - b.session_number);
    const planned = scheduled.filter(({ event_date }) => event_date === date)
      .sort((a, b) => a.session_number - b.session_number);
    const times = [...new Set(published.filter((entry) => entry.date === date)
      .map(({ start_time }) => start_time))].sort();
    const slots = Array.from({ length: Math.max(planned.length, times.length) }, (_, index) => ({
      number: planned[index]?.session_number ?? ordinal + index,
      startTime: times[index],
    }));
    ordinal += Math.max(slots.length, recorded.length);

    const available = new Set(recorded);
    const matches = slots.map(({ number }) => {
      const event = recorded.find((entry) => entry.session_number === number && available.has(entry));
      if (event) available.delete(event);
      return event;
    });
    const usedNumbers = new Set(recorded.map(({ session_number }) => session_number));
    const options: LeagueSessionOption[] = slots.map(({ number, startTime }, index) => {
      const event = matches[index] ?? available.values().next().value;
      if (event) {
        available.delete(event);
        return { key: event.id, date, number: event.session_number, startTime, event };
      }

      while (usedNumbers.has(number)) number += 1;
      usedNumbers.add(number);
      return { key: `${date}:${number}`, date, number, startTime };
    });
    return [...options, ...[...available].map((event) => ({
      key: event.id, date, number: event.session_number, event,
    }))];
  });
}
