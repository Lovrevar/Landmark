import { useState, useEffect } from 'react'

/**
 * Subscribe to a CSS media query and re-render when it changes.
 * SSR-safe: returns false until mounted.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
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
