export const memberFeeCents = 1500;
export const nonmemberFeeCents = 2500;
export const payoutPercent = 15;
export const maxPayingPlayers = 10000;
export const defaultEntryFees = { memberCents: memberFeeCents, nonmemberCents: nonmemberFeeCents };

export function isPaidPlayerCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maxPayingPlayers;
}

export function calculateSessionRevenue(members: number, nonmembers: number, fees = defaultEntryFees) {
  const memberRevenue = members * fees.memberCents;
  const nonmemberRevenue = nonmembers * fees.nonmemberCents;
  const gross = memberRevenue + nonmemberRevenue;
  const sessionPayout = Math.round(gross * payoutPercent / 100);
  const seasonContribution = sessionPayout;
  const totalPayout = sessionPayout + seasonContribution;
  return {
    players: members + nonmembers,
    memberRevenue,
    nonmemberRevenue,
    gross,
    sessionPayout,
    seasonContribution,
    totalPayout,
    clubRevenue: gross - totalPayout,
  };
}

export type SavedSessionRevenue = {
  member_count: number;
  nonmember_count: number;
  revision: string;
  updated_at: string;
};

const dollars = (cents: number) => (cents / 100).toFixed(2);
const revenueHeaders = [
  "Paid members", "Paid non-members", "Paid players", "Member fee (USD)", "Non-member fee (USD)",
  "Member revenue (USD)", "Non-member revenue (USD)", "Gross revenue (USD)", "Session payout 15% (USD)",
  "Season payout contribution 15% (USD)", "Total payout 30% (USD)", "Remaining revenue 70% (USD)",
];

function revenueColumns(members: number, nonmembers: number, revenue: ReturnType<typeof calculateSessionRevenue>) {
  return [
    members, nonmembers, revenue.players, dollars(memberFeeCents), dollars(nonmemberFeeCents),
    dollars(revenue.memberRevenue), dollars(revenue.nonmemberRevenue), dollars(revenue.gross),
    dollars(revenue.sessionPayout), dollars(revenue.seasonContribution), dollars(revenue.totalPayout),
    dollars(revenue.clubRevenue),
  ];
}

function writeRevenueCsv(rows: (string | number)[][]) {
  return rows.map((cells) => cells.map((cell) =>
    typeof cell === "number" ? cell : '"' + (/^[\t\r\n]|^\s*[=+@-]/.test(cell) ? "'" : "") + cell.replaceAll('"', '""') + '"',
  ).join(",")).join("\r\n") + "\r\n";
}

export function sessionRevenueCsv(
  event: { league: string; season: string; date: string; session: number; name: string },
  report: SavedSessionRevenue,
) {
  const revenue = calculateSessionRevenue(report.member_count, report.nonmember_count);
  const header = [
    "League", "Season", "Session date", "Session", "Session name", ...revenueHeaders, "Report updated (UTC)",
  ];
  const row = [
    event.league, event.season, event.date, event.session, event.name,
    ...revenueColumns(report.member_count, report.nonmember_count, revenue), report.updated_at,
  ];
  return writeRevenueCsv([header, row]);
}

type RevenueCounts = Pick<SavedSessionRevenue, "member_count" | "nonmember_count" | "updated_at">;

export type SeasonRevenueSession = {
  event_date: string;
  session_number: number;
  name: string;
  status: string;
  league_session_revenue: RevenueCounts | null;
};

export function summarizeSeasonRevenue(sessions: SeasonRevenueSession[]) {
  const totals = { ...calculateSessionRevenue(0, 0), members: 0, nonmembers: 0, saved: 0, missing: 0 };
  for (const session of sessions) {
    const report = session.league_session_revenue;
    if (!report) {
      if (session.status === "complete") totals.missing += 1;
      continue;
    }
    totals.saved += 1;
    totals.members += report.member_count;
    totals.nonmembers += report.nonmember_count;
    const amounts = calculateSessionRevenue(report.member_count, report.nonmember_count);
    for (const field of Object.keys(amounts) as Array<keyof typeof amounts>) totals[field] += amounts[field];
  }
  return totals;
}

export function paidEntryMix(members: number, nonmembers: number) {
  const entries = members + nonmembers;
  if (!entries) return null;
  const memberTenths = Math.round(members * 1000 / entries);
  return { members: memberTenths / 10, nonmembers: (1000 - memberTenths) / 10 };
}

export type HistoricalPaidEntries = {
  members: number;
  nonmembers: number;
  reports: number;
  scope: "league" | "all";
};

export function estimatePaidEntries(total: number, history: HistoricalPaidEntries) {
  const historicalTotal = history.members + history.nonmembers;
  if (!historicalTotal || !isPaidPlayerCount(total)) return null;
  const members = Math.round(total * history.members / historicalTotal);
  return { members, nonmembers: total - members };
}

export function seasonRevenueCsv(league: string, season: string, sessions: SeasonRevenueSession[]) {
  const totals = summarizeSeasonRevenue(sessions);
  const header = [
    "League", "Season", "Session date", "Session", "Session name", "Report status", ...revenueHeaders, "Report updated (UTC)",
  ];
  const summary = [
    league, season, "", "", "Season total (saved reports)", `${totals.saved} saved / ${totals.missing} completed without a report`,
    ...revenueColumns(totals.members, totals.nonmembers, totals), "",
  ];
  const details = [...sessions].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.session_number - b.session_number)
    .flatMap((session) => {
      const report = session.league_session_revenue;
      const heading = [league, season, session.event_date, session.session_number, session.name];
      if (report) {
        const revenue = calculateSessionRevenue(report.member_count, report.nonmember_count);
        return [[...heading, "Saved", ...revenueColumns(report.member_count, report.nonmember_count, revenue), report.updated_at]];
      }
      return session.status === "complete" ? [[...heading, "Missing report", ...revenueHeaders.map(() => ""), ""]] : [];
    });

  return writeRevenueCsv([header, summary, ...details]);
}
