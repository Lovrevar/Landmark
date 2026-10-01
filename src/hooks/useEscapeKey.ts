import { useEffect, useRef } from 'react'

// Escape closes the topmost open layer (modal, dialog, drawer, popover) and nothing under it.
//
// Before this, every layer attached its own document keydown listener. Document listeners run
// in the order they were added, so the layer underneath — opened first — heard Escape first:
// Escape on "Delete task?" closed the whole task drawer, and Escape in the AI panel's delete
// dialog closed the panel and lost the draft. Every layer now registers here instead, and a
// single listener hands the key to whichever layer was opened last.
//
// A keydown that something already handled is left alone. An input that uses Escape to cancel
// its own edit (a title field, a rename box, the @mention list) calls preventDefault in its
// React onKeyDown, and React's listeners run before this document one.

type EscapeLayer = { current: () => void }

const stack: EscapeLayer[] = []
let listening = false

type EscapeEvent = Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'preventDefault'>

/** Hands an Escape keydown to the topmost layer. Returns whether a layer took it. */
export function dispatchEscape(e: EscapeEvent): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented) return false
  const top = stack[stack.length - 1]
  if (!top) return false
  e.preventDefault()
  top.current()
  return true
}

const onKeyDown = (e: KeyboardEvent) => {
  dispatchEscape(e)
}

/**
 * Puts a layer on top of the stack and returns the function that takes it off. The layer is a
 * ref, so its handler can change on every render without moving it in the stack.
 */
export function pushEscapeLayer(layer: EscapeLayer): () => void {
  stack.push(layer)
  if (!listening && typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeyDown)
    listening = true
  }
  return () => {
    const index = stack.lastIndexOf(layer)
    if (index !== -1) stack.splice(index, 1)
    if (stack.length === 0 && listening) {
      document.removeEventListener('keydown', onKeyDown)
      listening = false
    }
  }
}

/**
 * Calls `onEscape` when Escape is pressed while this layer is the topmost active one.
 *
 * `active` decides when the layer joins the stack — pass the layer's open flag (`show`), or
 * `true` for a component that only exists while it is open. `onEscape` may be an inline
 * function; it is read at key time, not captured at registration.
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape)
  handler.current = onEscape

  useEffect(() => {
    if (!active) return
    return pushEscapeLayer(handler)
  }, [active])
}
