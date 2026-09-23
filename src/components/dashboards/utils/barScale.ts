/**
 * The shared denominator for a set of monthly incoming/outgoing bars: the largest value in either
 * series across every month, so a bar's length compares across rows. Computing it per month made
 * each row's larger bar full width, so a quiet January looked as big as a busy December.
 *
 * Floored at 1 so an empty list or an all-zero year divides by 1, not by 0 or -Infinity.
 */
export function monthlyBarMax(data: ReadonlyArray<{ incoming: number; outgoing: number }>): number {
  let max = 1
  for (const d of data) {
    if (d.incoming > max) max = d.incoming
    if (d.outgoing > max) max = d.outgoing
  }
  return max
}

/** A bar's width as a percentage of `max`, clamped to 0–100. */
export function barPercent(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value) || value <= 0) return 0
  return Math.min((value / max) * 100, 100)
}
