import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchEscape, pushEscapeLayer } from './useEscapeKey'

function escapeEvent(overrides: Partial<{ key: string; defaultPrevented: boolean }> = {}) {
  const event = {
    key: 'Escape',
    defaultPrevented: false,
    preventDefault: vi.fn(() => {
      event.defaultPrevented = true
    }),
    ...overrides,
  }
  return event
}

describe('escape layer stack', () => {
  const cleanups: Array<() => void> = []
  const push = (fn: () => void) => {
    const layer = { current: fn }
    const pop = pushEscapeLayer(layer)
    cleanups.push(pop)
    return { layer, pop }
  }

  afterEach(() => {
    while (cleanups.length) cleanups.pop()!()
  })

  it('closes only the topmost layer', () => {
    const parent = vi.fn()
    const child = vi.fn()
    push(parent)
    push(child)

    const event = escapeEvent()
    expect(dispatchEscape(event)).toBe(true)

    expect(child).toHaveBeenCalledTimes(1)
    expect(parent).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('hands Escape back to the parent once the child is removed', () => {
    const parent = vi.fn()
    const child = vi.fn()
    push(parent)
    const { pop } = push(child)

    pop()
    dispatchEscape(escapeEvent())

    expect(parent).toHaveBeenCalledTimes(1)
    expect(child).not.toHaveBeenCalled()
  })

  it('leaves an Escape that an inner input already handled alone', () => {
    const layer = vi.fn()
    push(layer)

    const event = escapeEvent({ defaultPrevented: true })
    expect(dispatchEscape(event)).toBe(false)

    expect(layer).not.toHaveBeenCalled()
  })

  it('ignores other keys', () => {
    const layer = vi.fn()
    push(layer)

    expect(dispatchEscape(escapeEvent({ key: 'Enter' }))).toBe(false)
    expect(layer).not.toHaveBeenCalled()
  })

  it('keeps a layer in place when its handler changes', () => {
    const parentFirst = vi.fn()
    const parentLater = vi.fn()
    const child = vi.fn()
    const { layer: parent } = push(parentFirst)
    push(child)

    // A parent re-rendering with a new inline onClose must not jump above the child.
    parent.current = parentLater
    dispatchEscape(escapeEvent())

    expect(child).toHaveBeenCalledTimes(1)
    expect(parentFirst).not.toHaveBeenCalled()
    expect(parentLater).not.toHaveBeenCalled()
  })

  it('does nothing when no layer is open', () => {
    const event = escapeEvent()
    expect(dispatchEscape(event)).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
