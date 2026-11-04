// At most 30 tool calls per user per minute, as a sliding window kept in
// memory. Per isolate, so best effort: two warm isolates each allow 30. Chat's
// limiter counts ai_messages rows, which this API never writes.

export const TOOL_CALLS_PER_MINUTE = 30
const WINDOW_MS = 60_000

export class RateLimiter {
  private calls = new Map<string, number[]>()

  constructor(
    private readonly limit = TOOL_CALLS_PER_MINUTE,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a call for `userId` and says whether it is within the limit. A
   * refused call is not recorded. */
  allow(userId: string): boolean {
    const t = this.now()
    const recent = (this.calls.get(userId) ?? []).filter((at) => at > t - WINDOW_MS)
    if (recent.length >= this.limit) {
      this.calls.set(userId, recent)
      return false
    }
    recent.push(t)
    this.calls.set(userId, recent)
    return true
  }

  /** Forget every call. For tests, which share one isolate. */
  clear(): void {
    this.calls.clear()
  }
}
