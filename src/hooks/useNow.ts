import { useEffect, useState } from 'react'

/**
 * The current time as epoch milliseconds, refreshed every `intervalMs`.
 *
 * Time is state, not something a render may read: `Date.now()` during render makes the output
 * depend on when the render ran, which the React Compiler rules (`react-hooks/purity`) refuse.
 * Held in state it keeps renders pure, and a view of "what is coming up" moves on without a prop
 * change. Pass a long interval for a value that only has to be roughly right, such as a
 * "last 7 days" cutoff.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
