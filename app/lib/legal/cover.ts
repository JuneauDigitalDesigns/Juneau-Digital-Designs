/**
 * The price line on the cover. Every plan is month to month since Terms of Service v6.0, so there
 * is one period to state.
 */
export function coverPrice(schedule: { monthlyPrice: number }): string {
  return `$${schedule.monthlyPrice.toLocaleString("en-US")} PER MONTH, BILLED MONTHLY`;
}
