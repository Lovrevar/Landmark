import { useEffect, useRef, type RefObject } from 'react'

// Keeps keyboard focus inside the topmost open modal layer (Modal, ConfirmDialog, the task
// drawer, …) and gives it back when the layer closes.
//
// Without it, opening a modal left focus on the button behind the overlay: Tab walked the page
// underneath, a screen reader never entered the dialog, and closing it dropped focus onto
// <body>. Layers stack the same way `useEscapeKey` does — a ConfirmDialog opened over a Modal
// traps inside the dialog, and closing it hands focus back to the Modal.
//
// Use it for modal layers only. Non-modal panels and popovers (the AI chat panel, the chat
// members panel, the calendar cluster popover) take Escape through useEscapeKey and nothing more.

type Trap = {
  container: RefObject<HTMLElement | null>
}

const stack: Trap[] = []
let listening = false

/** Where focus goes after pressing Tab (shift = Shift+Tab) from `current` among `count` stops.
 *  `current` is -1 when focus is on the container itself or somewhere unknown. */
export function nextTabIndex(current: number, count: number, shift: boolean): number {
  if (count === 0) return -1
  if (current === -1) return shift ? count - 1 : 0
  if (shift) return current === 0 ? count - 1 : current - 1
  return current === count - 1 ? 0 : current + 1
}

export function topTrap(): Trap | undefined {
  return stack[stack.length - 1]
}

export function pushTrap(trap: Trap): () => void {
  stack.push(trap)
  attachListeners()
  return () => {
    const index = stack.lastIndexOf(trap)
    if (index !== -1) stack.splice(index, 1)
    if (stack.length === 0) detachListeners()
  }
}

const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function tabbables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    el => el.getClientRects().length > 0 && !el.closest('[inert]'),
  )
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || e.defaultPrevented) return
  const container = topTrap()?.container.current
  if (!container) return
  const stops = tabbables(container)
  e.preventDefault()
  if (stops.length === 0) {
    container.focus()
    return
  }
  const current = stops.indexOf(document.activeElement as HTMLElement)
  stops[nextTabIndex(current, stops.length, e.shiftKey)].focus()
}

function onFocusIn(e: FocusEvent) {
  const container = topTrap()?.container.current
  if (!container) return
  const target = e.target as Node | null
  if (target && !container.contains(target)) container.focus()
}

function attachListeners() {
  if (listening || typeof document === 'undefined') return
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('focusin', onFocusIn)
  listening = true
}

function detachListeners() {
  if (!listening) return
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('focusin', onFocusIn)
  listening = false
}

/**
 * Traps focus in `containerRef` while `active`. The container should carry `tabIndex={-1}` so it
 * can hold focus itself.
 *
 * On activation focus moves to `initialFocus` if given, otherwise to the container — unless
 * something inside already has it (an `autoFocus` field wins). Focusing the container rather
 * than the first input keeps a phone's keyboard from popping up the moment a form opens, and
 * lets a screen reader announce the dialog's name first.
 *
 * On deactivation focus returns to whatever had it before, if that element is still on the page
 * and the user hasn't meanwhile moved focus somewhere else.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: { initialFocus?: RefObject<HTMLElement | null> } = {},
) {
  const initialFocus = useRef(options.initialFocus)
  initialFocus.current = options.initialFocus

  useEffect(() => {
    if (!active) return
    const restoreTo = document.activeElement as HTMLElement | null
    const pop = pushTrap({ container: containerRef })

    const container = containerRef.current
    if (container && !container.contains(document.activeElement)) {
      const target = initialFocus.current?.current ?? container
      target.focus({ preventScroll: true })
    }

    return () => {
      pop()
      const stillHere = restoreTo && restoreTo.isConnected && restoreTo !== document.body
      const focusIsOrphaned =
        !document.activeElement ||
        document.activeElement === document.body ||
        (container?.contains(document.activeElement) ?? false)
      if (stillHere && focusIsOrphaned) restoreTo.focus({ preventScroll: true })
    }
    // containerRef is a stable ref object; the trap is keyed on `active` alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
