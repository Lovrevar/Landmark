import { useEffect, type RefObject } from 'react'

// Re-fits a textarea to its content on every value change. Setting height
// to 'auto' first lets the element shrink back when text is removed, then
// scrollHeight gives the natural height clamped to maxPx. Caller controls
// overflow-y via Tailwind.
export function useAutoGrowTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxPx: number,
): void {
  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, maxPx)}px`
  }, [ref, value, maxPx])
}
