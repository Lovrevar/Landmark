import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { fetchTasksInRange } from '../../Tasks/services/tasksService'
import { expandTasks, type TaskOccurrence } from '../utils/expandTasks'
import type { Task } from '../../../types/tasks'

export interface UseTasksInRangeArgs {
  fromIso: string
  toIso: string
  enabled: boolean
  activeProjectId?: string | null
  activeParticipantIds?: string[]
  search?: string
}

export interface UseTasksInRangeResult {
  rawTasks: Task[]
  taskOccurrences: TaskOccurrence[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useTasksInRange({
  fromIso,
  toIso,
  enabled,
  activeProjectId = null,
  activeParticipantIds = [],
  search = '',
}: UseTasksInRangeArgs): UseTasksInRangeResult {
  const { user } = useAuth()
  const [rawTasks, setRawTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const reqIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!user || !enabled) {
      setRawTasks([])
      return
    }
    const id = ++reqIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTasksInRange(user.id, fromIso, toIso)
      if (id === reqIdRef.current) setRawTasks(data)
    } catch (e) {
      if (id === reqIdRef.current) setError(e as Error)
    } finally {
      if (id === reqIdRef.current) setLoading(false)
    }
  }, [user, fromIso, toIso, enabled])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user || !enabled) return
    let cancelled = false
    const reload = () => { if (!cancelled) load() }

    const tasksChannel = supabase
      .channel(`calendar-tasks-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, reload)
      .subscribe()

    const assigneesChannel = supabase
      .channel(`calendar-task-assignees-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignees' },
        reload,
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(tasksChannel)
      supabase.removeChannel(assigneesChannel)
    }
  }, [user, enabled, load])

  const taskOccurrences = useMemo(() => {
    if (!enabled) return []
    const lower = search.trim().toLowerCase()
    const filtered = rawTasks.filter(t => {
      if (activeProjectId && t.project_id !== activeProjectId) return false
      if (activeParticipantIds.length > 0) {
        const ids = new Set([t.created_by, ...(t.assignees?.map(a => a.user_id) || [])])
        const match = activeParticipantIds.some(id => ids.has(id))
        if (!match) return false
      }
      if (lower) {
        const hay = `${t.title} ${t.description}`.toLowerCase()
        if (!hay.includes(lower)) return false
      }
      return true
    })
    return expandTasks(filtered, new Date(fromIso), new Date(toIso))
  }, [rawTasks, fromIso, toIso, enabled, activeProjectId, activeParticipantIds, search])

  return { rawTasks, taskOccurrences, loading, error, refresh: load }
}
