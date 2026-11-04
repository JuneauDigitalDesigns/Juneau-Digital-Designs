/**
 * The price line on the cover. States the period the client chose; with no recorded choice it
 * names both, rather than printing the monthly price for a client who prepaid the year.
 */
export function coverPrice(
  schedule: { monthlyPrice: number; annualPrice: number },
  period?: "monthly" | "annual",
): string {
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (period === "annual") return `${usd(schedule.annualPrice)} PER YEAR, BILLED ANNUALLY`;
  if (period === "monthly") return `${usd(schedule.monthlyPrice)} PER MONTH, BILLED MONTHLY`;
  return `${usd(schedule.monthlyPrice)} PER MONTH, OR ${usd(schedule.annualPrice)} PER YEAR ON ANNUAL PREPAY`;
}
