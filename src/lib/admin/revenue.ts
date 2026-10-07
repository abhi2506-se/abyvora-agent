/**
 * Revenue accounting rules — ONE definition shared by every dashboard card,
 * chart, report and export so numbers can never disagree between screens.
 *
 *  - Gross revenue  = payments that actually settled, dated by `paidAt`.
 *                     A payment that was later (partially) refunded still
 *                     counts as gross; the refund is deducted separately.
 *  - Refunds        = Refund rows with status PROCESSED, dated by `processedAt`.
 *  - Net revenue    = gross − refunds.
 *  - FAILED / CANCELLED / CREATED / PENDING / AUTHORIZED payments are never
 *    revenue (reported separately as "failed" so they remain visible).
 */

export const REVENUE_PAYMENT_STATUSES = [
  "CAPTURED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "REFUND_PENDING",
] as const;

export const FAILED_PAYMENT_STATUSES = ["FAILED", "CANCELLED"] as const;

export function isRevenueStatus(status: string): boolean {
  return (REVENUE_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export function netRevenue(gross: number, refunds: number): number {
  return Math.round((gross - refunds) * 100) / 100;
}

/** Raw SQL fragment of the settled statuses — constants only, never user input. */
export const REVENUE_STATUS_SQL = "('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','REFUND_PENDING')";
