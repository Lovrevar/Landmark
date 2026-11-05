import { useCallback, useSyncExternalStore } from 'react'

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * Subscribe to a CSS media query and re-render when it changes.
 *
 * The media query list is an external store, so `useSyncExternalStore` reads it: no state copy to
 * keep in step from an effect, and a changed `query` is read on the next render rather than one
 * render late. Without `matchMedia` (a server, an old test environment) it is false.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (!canMatch()) return () => {}
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  const getSnapshot = () => (canMatch() ? window.matchMedia(query).matches : false)

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

// Breakpoints mirror Tailwind defaults (sm 640, md 768, lg 1024).
// "Mobile" = below the md breakpoint, where the desktop sidebar/header no longer fit.

/** True on phones / narrow viewports (< 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/** True on tablet-and-up (>= 768px). */
export function useIsTabletUp(): boolean {
  return useMediaQuery('(min-width: 768px)')
}

/** True on desktop-and-up (>= 1024px). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
