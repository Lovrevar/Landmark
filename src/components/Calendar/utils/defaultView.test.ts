import { describe, it, expect } from 'vitest'
import { defaultView } from './defaultView'

describe('defaultView', () => {
  it('opens the agenda on a phone and the month elsewhere', () => {
    expect(defaultView(true)).toBe('agenda')
    expect(defaultView(false)).toBe('month')
  })
})
