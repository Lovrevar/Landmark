import { describe, it, expect } from 'vitest'
import { EVENT_TYPES, EVENT_TYPE_COLORS, type EventTypeStyle } from './eventTypeColors'

// The map is typed Record<EventType, EventTypeStyle>, so tsc already refuses a missing type or
// a missing slot. These tests guard what the type system cannot see: the ordered list drifting
// from the map, an empty class string, and the hues drifting apart again.

const SLOTS: (keyof EventTypeStyle)[] = ['border', 'dot', 'surface', 'outline', 'badge']
/** Slots that colour a background, text or border and so need a dark-mode pair. */
const THEMED_SLOTS: (keyof EventTypeStyle)[] = ['surface', 'outline', 'badge']

const HUE = /-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/

function huesOf(style: EventTypeStyle): Set<string> {
  const hues = new Set<string>()
  for (const slot of SLOTS) {
    for (const token of style[slot].split(/\s+/)) {
      const m = token.match(HUE)
      if (m) hues.add(m[1])
    }
  }
  return hues
}

describe('EVENT_TYPE_COLORS', () => {
  it('lists every event type exactly once, and the list matches the map', () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length)
    expect([...EVENT_TYPES].sort()).toEqual(Object.keys(EVENT_TYPE_COLORS).sort())
  })

  it('fills every slot of every type with a class string', () => {
    for (const type of EVENT_TYPES) {
      const style = EVENT_TYPE_COLORS[type]
      expect(Object.keys(style).sort()).toEqual([...SLOTS].sort())
      for (const slot of SLOTS) {
        expect(typeof style[slot]).toBe('string')
        expect(style[slot].trim()).not.toBe('')
      }
    }
  })

  it('uses one hue per type across all slots, and no two types share one', () => {
    const seen = new Map<string, string>()
    for (const type of EVENT_TYPES) {
      const hues = huesOf(EVENT_TYPE_COLORS[type])
      expect([...hues], type).toHaveLength(1)
      const [hue] = hues
      expect(seen.get(hue), `${type} reuses ${hue}`).toBeUndefined()
      seen.set(hue, type)
    }
  })

  it('keeps reminder amber, matching the task palette', () => {
    expect([...huesOf(EVENT_TYPE_COLORS.reminder)]).toEqual(['amber'])
  })

  it('pairs every background, text and border colour with a dark: variant', () => {
    for (const type of EVENT_TYPES) {
      for (const slot of THEMED_SLOTS) {
        const tokens = EVENT_TYPE_COLORS[type][slot].split(/\s+/)
        for (const token of tokens.filter(t => !t.startsWith('dark:'))) {
          const prefix = token.match(/^(bg|text|border)-/)?.[1]
          if (!prefix) continue
          expect(
            tokens.some(t => t.startsWith(`dark:${prefix}-`)),
            `${type}.${slot}: ${token} has no dark pair`,
          ).toBe(true)
        }
      }
    }
  })
})
