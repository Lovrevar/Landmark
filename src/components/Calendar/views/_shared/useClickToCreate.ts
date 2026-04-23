import { useCallback, useRef, useState } from 'react'
import {
  DAY_HOURS,
  HOUR_HEIGHT,
  SLOT_MINUTES,
  VISIBLE_START_MIN,
  pxToMinutes,
  snapMinutes,
} from './timeSlots'

export interface SlotSelection {
  day: Date            // local midnight of the selected day
  startMinutes: number // minutes from day start
  endMinutes: number   // minutes from day start
}

export interface UseClickToCreateArgs {
  /** Resolve which day the pointer hit. WeekView passes the Monday-indexed day; DayView passes its single day. */
  dayForPointer: (event: PointerEvent | React.PointerEvent) => Date | null
  /** Minimum duration of a click-to-create, in minutes. */
  minMinutes?: number
  /** Fires after pointer-up if the user actually made a selection. */
  onComplete: (selection: SlotSelection) => void
}

interface DraftState {
  day: Date
  startPx: number
  currentPx: number
}

/** Pointer-driven slot selection for Day/Week timelines.
 *
 *  A click (no drag) produces a single-slot selection of `SLOT_MINUTES` minutes.
 *  A drag produces a selection from the starting slot to the current pointer,
 *  snapped to `SLOT_MINUTES` granularity. */
export function useClickToCreate({ dayForPointer, minMinutes = SLOT_MINUTES, onComplete }: UseClickToCreateArgs) {
  const [draft, setDraft] = useState<DraftState | null>(null)
  const draftRef = useRef<DraftState | null>(null)
  draftRef.current = draft

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const day = dayForPointer(e)
    if (!day) return
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    if (offsetY < 0 || offsetY > rect.height) return

    target.setPointerCapture(e.pointerId)
    setDraft({ day, startPx: offsetY, currentPx: offsetY })
  }, [dayForPointer])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draftRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height)
    setDraft(d => (d ? { ...d, currentPx: offsetY } : d))
  }, [])

  const finish = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = draftRef.current
    setDraft(null)
    if (!d) return
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }

    // Pixels are measured from the top of the visible column (DAY_START_HOUR).
    // Convert to minutes from the visible start, clamp within the visible
    // window, then shift back to minutes-from-midnight for consumers.
    const columnMinutesMax = DAY_HOURS * 60
    const startMinInColumn = snapMinutes(pxToMinutes(Math.min(d.startPx, d.currentPx)))
    const endMinRawInColumn = snapMinutes(pxToMinutes(Math.max(d.startPx, d.currentPx)))
    let endMinInColumn = endMinRawInColumn <= startMinInColumn
      ? startMinInColumn + minMinutes
      : endMinRawInColumn
    if (endMinInColumn > columnMinutesMax) endMinInColumn = columnMinutesMax
    if (startMinInColumn === endMinInColumn) endMinInColumn = startMinInColumn + minMinutes

    onComplete({
      day: d.day,
      startMinutes: startMinInColumn + VISIBLE_START_MIN,
      endMinutes: endMinInColumn + VISIBLE_START_MIN,
    })
  }, [minMinutes, onComplete])

  const cancel = useCallback(() => setDraft(null), [])

  return {
    draft,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finish,
      onPointerCancel: cancel,
    },
  }
}

export function minutesToStyle(startMin: number, endMin: number) {
  // Round to whole pixels so adjacent event cards share exact integer
  // boundaries — sub-pixel values can produce a 1-px visual bleed into the
  // next hour row even though the content itself is clipped.
  const top = Math.round((startMin / 60) * HOUR_HEIGHT)
  const rawHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT
  const height = Math.max(12, Math.round(rawHeight))
  return { top: `${top}px`, height: `${height}px` }
}
