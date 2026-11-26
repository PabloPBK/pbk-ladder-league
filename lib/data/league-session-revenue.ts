export const memberFeeCents = 1500;
export const nonmemberFeeCents = 2500;
export const payoutPercent = 15;
export const maxPayingPlayers = 10000;

export function isPaidPlayerCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maxPayingPlayers;
}

export function calculateSessionRevenue(members: number, nonmembers: number) {
  const memberRevenue = members * memberFeeCents;
  const nonmemberRevenue = nonmembers * nonmemberFeeCents;
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

export function sessionRevenueCsv(
  event: { league: string; season: string; date: string; session: number; name: string },
  report: SavedSessionRevenue,
) {
  const revenue = calculateSessionRevenue(report.member_count, report.nonmember_count);
  const dollars = (cents: number) => (cents / 100).toFixed(2);
  const header = [
    "League", "Season", "Session date", "Session", "Session name", "Paid members", "Paid non-members",
    "Paid players", "Member fee (USD)", "Non-member fee (USD)", "Member revenue (USD)", "Non-member revenue (USD)",
    "Gross revenue (USD)", "Session payout 15% (USD)", "Season payout contribution 15% (USD)",
    "Total payout 30% (USD)", "Remaining revenue 70% (USD)", "Report updated (UTC)",
  ];
  const row = [
    event.league, event.season, event.date, event.session, event.name, report.member_count, report.nonmember_count,
    revenue.players, dollars(memberFeeCents), dollars(nonmemberFeeCents),
    dollars(revenue.memberRevenue), dollars(revenue.nonmemberRevenue), dollars(revenue.gross),
    dollars(revenue.sessionPayout), dollars(revenue.seasonContribution), dollars(revenue.totalPayout),
    dollars(revenue.clubRevenue), report.updated_at,
  ];
  return [header, row].map((cells) => cells.map((cell) =>
    typeof cell === "number" ? cell : '"' + (/^[\t\r\n]|^\s*[=+@-]/.test(cell) ? "'" : "") + cell.replaceAll('"', '""') + '"',
  ).join(",")).join("\r\n") + "\r\n";
}
