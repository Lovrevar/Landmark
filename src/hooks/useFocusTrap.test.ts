import { afterEach, describe, expect, it } from 'vitest'
import { nextTabIndex, pushTrap, topTrap } from './useFocusTrap'

describe('nextTabIndex', () => {
  it('moves forward and wraps from the last stop to the first', () => {
    expect(nextTabIndex(0, 3, false)).toBe(1)
    expect(nextTabIndex(2, 3, false)).toBe(0)
  })

  it('moves backward and wraps from the first stop to the last', () => {
    expect(nextTabIndex(2, 3, true)).toBe(1)
    expect(nextTabIndex(0, 3, true)).toBe(2)
  })

  it('enters at the edge when focus is on the container itself', () => {
    expect(nextTabIndex(-1, 3, false)).toBe(0)
    expect(nextTabIndex(-1, 3, true)).toBe(2)
  })

  it('has nowhere to go without stops', () => {
    expect(nextTabIndex(-1, 0, false)).toBe(-1)
  })
})

describe('trap stack', () => {
  const pops: Array<() => void> = []
  const trap = () => ({ container: { current: null } })

  afterEach(() => {
    while (pops.length) pops.pop()!()
  })

  it('acts on the most recently opened layer', () => {
    const modal = trap()
    const dialog = trap()
    pops.push(pushTrap(modal))
    pops.push(pushTrap(dialog))
    expect(topTrap()).toBe(dialog)
  })

  it('hands control back to the layer underneath when the top one closes', () => {
    const modal = trap()
    const dialog = trap()
    pops.push(pushTrap(modal))
    const closeDialog = pushTrap(dialog)
    closeDialog()
    expect(topTrap()).toBe(modal)
  })

  it('is empty once every layer has closed', () => {
    pushTrap(trap())()
    expect(topTrap()).toBeUndefined()
  })
})
