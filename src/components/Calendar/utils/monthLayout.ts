import type { ExpandedOccurrence } from './recurrence'

export interface PlacedSegment {
  occurrence: ExpandedOccurrence
  weekRow: number      // 0..5 — which 7-day grid row
  startCol: number     // 0..6 (Mon..Sun)
  endCol: number       // inclusive
  slot: number         // 0-indexed vertical slot within the row
  continuesLeft: boolean  // event started in an earlier week
  continuesRight: boolean // event ends in a later week
}

export interface MonthLayout {
  segmentsByWeek: PlacedSegment[][]       // length = 6
  /**
   * Day key (toDateString) → the slots of the segments covering that day. Slots are stable
   * across the week row, so a day can have gaps: an event can sit in slot 2 on a day where
   * slots 0 and 1 are empty. Feed it to `cellRows` rather than counting it.
   */
  eventSlotsByDay: Map<string, number[]>
}

export interface CellRows {
  /** The row each of the day's first tasks takes, in order. Its length is how many are shown. */
  taskRows: number[]
  /** Events in a slot past the last row, plus tasks with no free row: the "+N more" count. */
  hiddenCount: number
}

/**
 * How one month cell spends its rows. Events keep the week-stable slots `computeMonthLayout`
 * gave them; tasks take the rows the events leave free on that day, top down; whatever does not
 * fit is counted into "+N more".
 *
 * Events and tasks share `maxRows`, the number of rows the cell has room for above its "+N more"
 * line. Giving tasks their own rows below the events is what used to push the third and later
 * pills past the cell's bottom edge into the next week.
 */
export function cellRows(eventSlots: readonly number[], taskCount: number, maxRows: number): CellRows {
  const taken = new Set(eventSlots)
  const taskRows: number[] = []
  for (let row = 0; row < maxRows && taskRows.length < taskCount; row++) {
    if (!taken.has(row)) taskRows.push(row)
  }
  const hiddenEvents = eventSlots.filter(slot => slot >= maxRows).length
  return { taskRows, hiddenCount: hiddenEvents + (taskCount - taskRows.length) }
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function startOfDayLocal(d: Date): Date {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

export function computeMonthLayout(
  occurrences: ExpandedOccurrence[],
  gridStart: Date, // first cell (Monday of the first week)
): MonthLayout {
  const gridStartDay = startOfDayLocal(gridStart)

  // Split each occurrence into per-week segments
  const draftSegments: Omit<PlacedSegment, 'slot'>[] = []

  for (const occ of occurrences) {
    const occStartDay = startOfDayLocal(occ.start)
    const occEndDay = startOfDayLocal(occ.end)
    // If end is exactly midnight, treat as previous day
    let adjustedEnd = occEndDay
    if (occ.end.getHours() === 0 && occ.end.getMinutes() === 0 && occ.end > occ.start) {
      adjustedEnd = new Date(occEndDay.getTime() - 1000 * 60 * 60 * 24)
    }

    const startDiff = daysBetween(gridStartDay, occStartDay)
    const endDiff = daysBetween(gridStartDay, adjustedEnd)

    // Clip to visible 0..41
    const firstVisibleDay = Math.max(0, startDiff)
    const lastVisibleDay = Math.min(41, endDiff)
    if (firstVisibleDay > 41 || lastVisibleDay < 0 || firstVisibleDay > lastVisibleDay) continue

    // Split across week rows
    let cursor = firstVisibleDay
    while (cursor <= lastVisibleDay) {
      const weekRow = Math.floor(cursor / 7)
      const weekStart = weekRow * 7
      const weekEnd = weekStart + 6
      const segEnd = Math.min(lastVisibleDay, weekEnd)
      draftSegments.push({
        occurrence: occ,
        weekRow,
        startCol: cursor - weekStart,
        endCol: segEnd - weekStart,
        continuesLeft: cursor > startDiff,
        continuesRight: segEnd < endDiff,
      })
      cursor = segEnd + 1
    }
  }

  // Assign slots per week row (greedy, multi-day bars first)
  const segmentsByWeek: PlacedSegment[][] = [[], [], [], [], [], []]

  for (let row = 0; row < 6; row++) {
    const rowSegs = draftSegments.filter(s => s.weekRow === row)
    // Multi-day first, then earlier-start, then longer first
    rowSegs.sort((a, b) => {
      const aLen = a.endCol - a.startCol
      const bLen = b.endCol - b.startCol
      if (aLen !== bLen) return bLen - aLen
      if (a.startCol !== b.startCol) return a.startCol - b.startCol
      return a.occurrence.start.getTime() - b.occurrence.start.getTime()
    })

    const slotUsage: boolean[][] = [] // slotUsage[slot][col]
    for (const seg of rowSegs) {
      let slot = 0
      while (true) {
        if (!slotUsage[slot]) slotUsage[slot] = new Array(7).fill(false)
        let fits = true
        for (let c = seg.startCol; c <= seg.endCol; c++) {
          if (slotUsage[slot][c]) { fits = false; break }
        }
        if (fits) {
          for (let c = seg.startCol; c <= seg.endCol; c++) slotUsage[slot][c] = true
          segmentsByWeek[row].push({ ...seg, slot })
          break
        }
        slot++
      }
    }
  }

  // Per-day slots, for placing task pills and counting "+N more"
  const eventSlotsByDay = new Map<string, number[]>()
  segmentsByWeek.forEach((segs, row) => {
    for (let col = 0; col < 7; col++) {
      const dayIdx = row * 7 + col
      const d = new Date(gridStartDay)
      d.setDate(gridStartDay.getDate() + dayIdx)
      const key = d.toDateString()
      const slots = segs.filter(s => s.startCol <= col && s.endCol >= col).map(s => s.slot)
      eventSlotsByDay.set(key, slots)
    }
  })

  return { segmentsByWeek, eventSlotsByDay }
}
