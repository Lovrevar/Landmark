import { useCallback, useEffect, useRef, useState } from 'react'
import type { PhaseStatus } from '../utils'

const DEFAULT_NAMESPACE = 'milestone_phase_collapse'

function storageKeyFor(projectId: string | undefined, namespace: string): string | null {
  return projectId ? `cognilion.${namespace}.${projectId}` : null
}

function readOverrides(projectId: string | undefined, namespace: string): Record<string, boolean> {
  const key = storageKeyFor(projectId, namespace)
  if (!key || typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

// Defaults applied to phases the user has never explicitly toggled.
// - Any overdue → expanded (the user almost certainly wants to see what's late)
// - Fully completed → collapsed (done work, get it out of the way)
// - Nothing started yet (0 done, 0 overdue) → collapsed (future work, not actionable)
// - In-progress mix (some done, none overdue, not all done) → expanded
function computeDefault(status: PhaseStatus): boolean {
  if (status.overdue > 0) return true
  if (status.total === 0) return false
  if (status.completed === status.total) return false
  if (status.completed === 0) return false
  return true
}

export interface PhaseCollapseController {
  isExpanded: (key: string) => boolean
  toggle: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  allExpanded: boolean
}

export function usePhaseCollapseState(
  projectId: string | undefined,
  phases: PhaseStatus[],
  namespace: string = DEFAULT_NAMESPACE
): PhaseCollapseController {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => readOverrides(projectId, namespace))
  const hydratedFor = useRef<string | undefined>(projectId)

  useEffect(() => {
    if (hydratedFor.current !== projectId) {
      hydratedFor.current = projectId
      setOverrides(readOverrides(projectId, namespace))
    }
  }, [projectId, namespace])

  useEffect(() => {
    const key = storageKeyFor(projectId, namespace)
    if (!key || typeof window === 'undefined') return
    if (hydratedFor.current !== projectId) return
    try {
      window.localStorage.setItem(key, JSON.stringify(overrides))
    } catch {
      // localStorage may be unavailable (private mode, quota); silently ignore.
    }
  }, [projectId, namespace, overrides])

  const resolve = useCallback(
    (key: string): boolean => {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key]
      const status = phases.find(p => p.key === key)
      return status ? computeDefault(status) : false
    },
    [overrides, phases]
  )

  const toggle = useCallback(
    (key: string) => {
      const current = resolve(key)
      setOverrides(prev => ({ ...prev, [key]: !current }))
    },
    [resolve]
  )

  const expandAll = useCallback(() => {
    setOverrides(prev => {
      const next = { ...prev }
      for (const p of phases) next[p.key] = true
      return next
    })
  }, [phases])

  const collapseAll = useCallback(() => {
    setOverrides(prev => {
      const next = { ...prev }
      for (const p of phases) next[p.key] = false
      return next
    })
  }, [phases])

  const allExpanded = phases.length > 0 && phases.every(p => resolve(p.key))

  return { isExpanded: resolve, toggle, expandAll, collapseAll, allExpanded }
}
