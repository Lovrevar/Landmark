import { useState, useEffect } from 'react'

export function useListPreferences<T extends object>(
  key: string,
  defaults: T
): [T, (patch: Partial<T>) => void] {
  const [prefs, setPrefs] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return defaults
      return { ...defaults, ...(JSON.parse(raw) as Partial<T>) }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
  }, [key, prefs])

  const patch = (p: Partial<T>) => setPrefs(prev => ({ ...prev, ...p }))

  return [prefs, patch]
}
