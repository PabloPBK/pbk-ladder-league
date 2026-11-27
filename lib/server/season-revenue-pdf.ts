import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { paidEntryMix, type summarizeSeasonRevenue } from "@/lib/data/league-session-revenue";
import { formatPrizeMoney } from "@/zz2-site/lib/league-contract";

export async function buildSeasonRevenuePdf(
  league: string,
  season: string,
  totals: ReturnType<typeof summarizeSeasonRevenue>,
): Promise<ArrayBuffer> {
  const document = await PDFDocument.create();
  document.setTitle(`${season} Revenue Report`);
  document.setAuthor("Pickleball Kingdom");

  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.07, 0.15, 0.12);
  const muted = rgb(0.29, 0.34, 0.31);
  const white = rgb(1, 1, 1);
  const rule = rgb(0.85, 0.88, 0.85);
  const green = rgb(0.11, 0.36, 0.25);
  const gold = rgb(0.96, 0.77, 0.20);
  const mix = paidEntryMix(totals.members, totals.nonmembers);
  const count = new Intl.NumberFormat("en-US");

  const text = (value: string, x: number, y: number, size = 11, color = dark, font = regular) =>
    page.drawText(value, { x, y, size, color, font });
  const box = (x: number, y: number, width: number, height: number, color: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y, width, height, color });
  const divider = (y: number) => box(46, y, 520, 1, rule);

  const safeCharacters = new Set(regular.getCharacterSet());
  let subtitle = [...[league.trim(), season].filter(Boolean).join("  /  ").normalize("NFKC")]
    .map((character) => safeCharacters.has(character.codePointAt(0) ?? 0) ? character : " ")
    .join("").replace(/\s+/g, " ").trim();
  if (regular.widthOfTextAtSize(subtitle, 13) > 520) {
    while (regular.widthOfTextAtSize(subtitle + "...", 13) > 520) subtitle = subtitle.slice(0, -1);
    subtitle += "...";
  }

  function amountRow(label: string, cents: number, y: number, left: number, right: number) {
    text(label, left, y, 10, muted);
    const amount = formatPrizeMoney(cents);
    text(amount, right - bold.widthOfTextAtSize(amount, 11), y, 11, dark, bold);
  }

  box(0, 637, 612, 155, dark);
  box(46, 745, 28, 3, gold);
  text("PICKLEBALL KINGDOM", 82, 741, 10, white, bold);
  text("Season Revenue Report", 46, 688, 32, white, bold);
  text(subtitle, 47, 662, 13, white);

  box(46, 543, 250, 68, rgb(0.94, 0.96, 0.94));
  box(310, 543, 256, 68, rgb(0.99, 0.96, 0.85));
  text("Gross revenue", 60, 588, 11, dark, bold);
  text(formatPrizeMoney(totals.gross), 60, 558, 24, dark, bold);
  text("End-of-season payout set aside", 324, 588, 11, dark, bold);
  text(formatPrizeMoney(totals.seasonContribution), 324, 558, 24, dark, bold);

  text("Paid entries by membership", 46, 512, 16, dark, bold);
  text(`${count.format(totals.players)} paid entries across saved session reports`, 46, 491, 10, muted);
  box(46, 462, 520, 12, mix ? gold : rule);
  if (mix && totals.members > 0) box(46, 462, 520 * totals.members / totals.players, 12, green);
  const memberLabel = mix ? `${mix.members.toFixed(1)}% members` : "Members";
  const nonmemberLabel = mix ? `${mix.nonmembers.toFixed(1)}% non-members` : "Non-members";
  text(`${memberLabel}  /  ${count.format(totals.members)} entries`, 46, 439, 11, green, bold);
  text(`${nonmemberLabel}  /  ${count.format(totals.nonmembers)} entries`, 310, 439, 11, dark, bold);
  divider(416);

  text("Revenue by source", 46, 389, 15, dark, bold);
  text("Revenue allocation", 310, 389, 15, dark, bold);
  amountRow("Member entry fees", totals.memberRevenue, 360, 46, 283);
  amountRow("Non-member entry fees", totals.nonmemberRevenue, 334, 46, 283);
  amountRow("Total gross revenue", totals.gross, 308, 46, 283);
  amountRow("Session payouts (15%)", totals.sessionPayout, 360, 310, 566);
  amountRow("End-of-season set-aside (15%)", totals.seasonContribution, 334, 310, 566);
  amountRow("Total prize allocation (30%)", totals.totalPayout, 308, 310, 566);
  amountRow("Remaining revenue (70%)", totals.clubRevenue, 282, 310, 566);
  divider(259);

  text("Session report coverage", 46, 225, 15, dark, bold);
  text(`${count.format(totals.saved)} saved ${totals.saved === 1 ? "report" : "reports"}  /  ${count.format(totals.missing)} completed without a report`, 46, 200, 11, dark, bold);
  text("The totals and set-aside are calculated from saved session reports.", 46, 176, 10, muted);
  text("A returning player is counted once for each session they paid to attend.", 46, 158, 10, muted);
  divider(82);
  text("Pickleball Kingdom  /  League reporting", 46, 62, 9, muted);
  text("1", 560, 62, 9, muted);

  return new Uint8Array(await document.save()).buffer;
}
