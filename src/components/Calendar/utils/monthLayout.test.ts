import { describe, it, expect } from 'vitest'
import { cellRows, computeMonthLayout } from './monthLayout'
import type { ExpandedOccurrence } from './recurrence'

const ROWS = 3

describe('cellRows', () => {
  it('gives an empty day all its rows for tasks', () => {
    expect(cellRows([], 2, ROWS)).toEqual({ taskRows: [0, 1], hiddenCount: 0 })
    expect(cellRows([], 3, ROWS)).toEqual({ taskRows: [0, 1, 2], hiddenCount: 0 })
  })

  it('puts tasks below the events and counts the ones that do not fit', () => {
    expect(cellRows([0], 3, ROWS)).toEqual({ taskRows: [1, 2], hiddenCount: 1 })
  })

  it('shows no task on a day whose events fill every row — they all go to "+N more"', () => {
    expect(cellRows([0, 1, 2], 3, ROWS)).toEqual({ taskRows: [], hiddenCount: 3 })
  })

  it('counts events in a slot past the last row', () => {
    expect(cellRows([0, 1, 2, 3, 4], 0, ROWS)).toEqual({ taskRows: [], hiddenCount: 2 })
    expect(cellRows([0, 1, 2, 3], 2, ROWS)).toEqual({ taskRows: [], hiddenCount: 3 })
  })

  it('fills a gap above an event instead of stacking the task on top of it', () => {
    // An event in slot 2 on a day where slots 0 and 1 are empty. Counting the day's events
    // (1) and stacking tasks from there used to put the second task in slot 2, over the event.
    expect(cellRows([2], 2, ROWS)).toEqual({ taskRows: [0, 1], hiddenCount: 0 })
    expect(cellRows([2], 3, ROWS)).toEqual({ taskRows: [0, 1], hiddenCount: 1 })
  })

  it('never hands out more rows than it has', () => {
    for (let events = 0; events <= 5; events++) {
      for (let tasks = 0; tasks <= 5; tasks++) {
        const slots = Array.from({ length: events }, (_, i) => i)
        const { taskRows, hiddenCount } = cellRows(slots, tasks, ROWS)
        const shownEvents = slots.filter(s => s < ROWS).length
        expect(shownEvents + taskRows.length).toBeLessThanOrEqual(ROWS)
        // Everything is either shown or counted, exactly once.
        expect(shownEvents + taskRows.length + hiddenCount).toBe(events + tasks)
      }
    }
  })
})

function occ(id: string, start: Date, end: Date): ExpandedOccurrence {
  return {
    occurrenceKey: id,
    event: { id, title: id } as ExpandedOccurrence['event'],
    start,
    end,
    originalStartIso: start.toISOString(),
    isRecurringInstance: false,
    isException: false,
    myResponse: 'accepted',
    myParticipantId: null,
    isDeclined: false,
  }
}

describe('computeMonthLayout eventSlotsByDay', () => {
  // Monday 7 September 2026 as the grid's first cell.
  const gridStart = new Date(2026, 8, 7)
  const day = (offset: number, hour = 10) => new Date(2026, 8, 7 + offset, hour)

  it('records the slots covering each day, gaps included', () => {
    // Three two-day bars stepping down the week: Mon–Wed takes slot 0, Tue–Thu slot 1 and
    // Wed–Fri slot 2. On Friday only the slot-2 bar is left, above two empty rows.
    const layout = computeMonthLayout(
      [
        occ('a', day(0), day(2, 11)),
        occ('b', day(1), day(3, 11)),
        occ('c', day(2), day(4, 11)),
      ],
      gridStart,
    )
    expect(layout.eventSlotsByDay.get(day(0).toDateString())).toEqual([0])
    expect(layout.eventSlotsByDay.get(day(2).toDateString())?.sort()).toEqual([0, 1, 2])
    expect(layout.eventSlotsByDay.get(day(4).toDateString())).toEqual([2])
    expect(layout.eventSlotsByDay.get(day(5).toDateString())).toEqual([])
  })
})
