export function parsePrizeAmount(input: unknown): number | null {
  if (typeof input !== "string") throw new Error("Enter a prize amount in US dollars.");
  const amount = input.trim();
  if (!amount) return null;
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new Error("Enter an amount from 0 to 999999.99 with up to two decimal places.");
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
