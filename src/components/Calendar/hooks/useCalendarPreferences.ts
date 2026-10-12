import { useCallback, useEffect, useMemo, useState } from 'react'
import { defaultView } from '../utils/defaultView'
import { useAuth } from '../../../contexts/AuthContext'

export type CalendarView = 'day' | 'week' | 'month' | 'agenda'

export interface CalendarPreferences {
  view: CalendarView
  activeTypes: string[]        // e.g. ['meeting','deadline']; empty = all
  activeProjectId: string | null
  activeParticipantIds: string[]
  enabledTeams: string[]
  showTasks: boolean
}

const DEFAULT_PREFS: CalendarPreferences = {
  view: 'month',
  activeTypes: [],
  activeProjectId: null,
  activeParticipantIds: [],
  enabledTeams: [],
  showTasks: false,
}

function storageKey(userId: string | undefined) {
  return userId ? `calendar.prefs.${userId}` : null
}

const isNarrowScreen = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 767px)').matches

function load(userId: string | undefined): CalendarPreferences {
  const fresh: CalendarPreferences = { ...DEFAULT_PREFS, view: defaultView(isNarrowScreen()) }
  const key = storageKey(userId)
  if (!key) return fresh
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fresh
    const parsed = JSON.parse(raw) as Partial<CalendarPreferences>
    return { ...fresh, ...parsed }
  } catch {
    return fresh
  }
}

export function useCalendarPreferences() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<CalendarPreferences>(() => load(user?.id))
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  useEffect(() => {
    setPrefs(load(user?.id))
  }, [user?.id])

  useEffect(() => {
    const key = storageKey(user?.id)
    if (!key) return
    try {
      window.localStorage.setItem(key, JSON.stringify(prefs))
    } catch {
      // quota / disabled storage — ignore
    }
  }, [prefs, user?.id])

  const setView = useCallback((view: CalendarView) => {
    setPrefs(p => ({ ...p, view }))
  }, [])

  const toggleType = useCallback((type: string) => {
    setPrefs(p => ({
      ...p,
      activeTypes: p.activeTypes.includes(type)
        ? p.activeTypes.filter(t => t !== type)
        : [...p.activeTypes, type],
    }))
  }, [])

  const setActiveProjectId = useCallback((id: string | null) => {
    setPrefs(p => ({ ...p, activeProjectId: id }))
  }, [])

  const setActiveParticipantIds = useCallback((ids: string[]) => {
    setPrefs(p => ({ ...p, activeParticipantIds: ids }))
  }, [])

  const toggleShowTasks = useCallback(() => {
    setPrefs(p => ({ ...p, showTasks: !p.showTasks }))
  }, [])

  const toggleTeam = useCallback((team: string) => {
    setPrefs(p => ({
      ...p,
      enabledTeams: p.enabledTeams.includes(team)
        ? p.enabledTeams.filter(t => t !== team)
        : [...p.enabledTeams, team],
    }))
  }, [])

  const goPrev = useCallback(() => {
    setAnchor(d => {
      const next = new Date(d)
      if (prefs.view === 'day') next.setDate(next.getDate() - 1)
      else if (prefs.view === 'week') next.setDate(next.getDate() - 7)
      else next.setMonth(next.getMonth() - 1)
      return next
    })
  }, [prefs.view])

  const goNext = useCallback(() => {
    setAnchor(d => {
      const next = new Date(d)
      if (prefs.view === 'day') next.setDate(next.getDate() + 1)
      else if (prefs.view === 'week') next.setDate(next.getDate() + 7)
      else next.setMonth(next.getMonth() + 1)
      return next
    })
  }, [prefs.view])

  const goToday = useCallback(() => setAnchor(new Date()), [])

  const jumpTo = useCallback((date: Date) => setAnchor(new Date(date)), [])

  return useMemo(() => ({
    prefs,
    anchor,
    setView,
    toggleType,
    setActiveProjectId,
    setActiveParticipantIds,
    toggleTeam,
    toggleShowTasks,
    goPrev,
    goNext,
    goToday,
    jumpTo,
  }), [
    prefs,
    anchor,
    setView,
    toggleType,
    setActiveProjectId,
    setActiveParticipantIds,
    toggleTeam,
    toggleShowTasks,
    goPrev,
    goNext,
    goToday,
    jumpTo,
  ])
}
