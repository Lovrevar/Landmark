import { describe, it, expect } from 'vitest'
import { statusConfig, statusConfigFor, stripeClass, unknownStatusConfig } from './workLogStatus'

describe('stripeClass', () => {
  it('gives each status its own literal left-border class', () => {
    expect(stripeClass('work_finished')).toBe('border-l-green-500 dark:border-l-green-500')
    expect(stripeClass('in_progress')).toBe('border-l-blue-500 dark:border-l-blue-500')
    expect(stripeClass('blocker')).toBe('border-l-red-500 dark:border-l-red-500')
    expect(stripeClass('quality_issue')).toBe('border-l-orange-500 dark:border-l-orange-500')
    expect(stripeClass('waiting_materials')).toBe('border-l-yellow-500 dark:border-l-yellow-500')
    expect(stripeClass('weather_delay')).toBe('border-l-gray-400 dark:border-l-gray-400')
  })

  it('falls back to grey for a log with no status', () => {
    expect(stripeClass(null)).toBe('border-l-gray-400 dark:border-l-gray-400')
    expect(stripeClass(undefined)).toBe('border-l-gray-400 dark:border-l-gray-400')
    expect(stripeClass('')).toBe('border-l-gray-400 dark:border-l-gray-400')
  })

  it('falls back to grey for a status this build does not know', () => {
    expect(stripeClass('something_new')).toBe(unknownStatusConfig.stripe)
  })

  it('keeps the stripe in the same hue as the badge, light and dark', () => {
    for (const config of [...Object.values(statusConfig), unknownStatusConfig]) {
      const hue = config.variant
      expect(config.stripe).toMatch(new RegExp(`^border-l-${hue}-\\d{3} dark:border-l-${hue}-\\d{3}$`))
    }
  })
})

describe('statusConfigFor', () => {
  it('returns the matching entry for a known status', () => {
    expect(statusConfigFor('blocker')).toBe(statusConfig.blocker)
  })

  it('returns the unknown entry for null, undefined and unknown values', () => {
    expect(statusConfigFor(null)).toBe(unknownStatusConfig)
    expect(statusConfigFor(undefined)).toBe(unknownStatusConfig)
    expect(statusConfigFor('WORK_FINISHED')).toBe(unknownStatusConfig)
  })

  it('does not resolve inherited Object properties as statuses', () => {
    expect(statusConfigFor('constructor')).toBe(unknownStatusConfig)
    expect(statusConfigFor('toString')).toBe(unknownStatusConfig)
  })
})
