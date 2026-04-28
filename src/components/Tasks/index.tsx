import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  CheckSquare,
  Inbox,
  Send,
  Lock,
  Search,
  ChevronDown,
  X,
} from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '../../contexts/AuthContext'
import { useTasks } from './hooks/useTasks'
import { useTasksRealtime } from './hooks/useTasksRealtime'
import { fetchProjectOptions, fetchTaskUsers, type ProjectOption } from './services/tasksService'
import ConfirmDialog from '../ui/ConfirmDialog'
import ToggleSwitch from '../ui/ToggleSwitch'
import type { Task, TaskStatus, TaskUser } from '../../types/tasks'
import TaskRow from './TaskRow'
import TaskModal from './TaskModal'
import TaskDetail from './TaskDetail'

type TabKey = 'assigned' | 'created' | 'private'
type SortKey = 'due' | 'created' | 'title'
type GroupKey = 'none' | 'project' | 'status' | 'due'

interface Filters {
  search: string
  statuses: TaskStatus[]
  projectId: string | null
  assigneeIds: string[]
  sort: SortKey
  group: GroupKey
  showCompleted: boolean
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  statuses: [],
  projectId: null,
  assigneeIds: [],
  sort: 'due',
  group: 'none',
  showCompleted: true,
}

const VIRTUALIZE_THRESHOLD = 100
const ROW_HEIGHT = 68
const HEADER_HEIGHT = 36

const STATUS_VALUES: TaskStatus[] = ['todo', 'in_progress', 'done']

function filtersKey(userId: string) {
  return `tasks.filters.${userId}`
}

function loadFilters(userId: string): Filters {
  try {
    const raw = localStorage.getItem(filtersKey(userId))
    if (!raw) return DEFAULT_FILTERS
    const parsed = JSON.parse(raw) as Partial<Filters>
    return { ...DEFAULT_FILTERS, ...parsed }
  } catch {
    return DEFAULT_FILTERS
  }
}

function saveFilters(userId: string, f: Filters) {
  try {
    localStorage.setItem(filtersKey(userId), JSON.stringify(f))
  } catch {
    /* ignore */
  }
}

function dueDateAsDate(task: Task): Date | null {
  if (!task.due_date) return null
  const time = task.due_time ? task.due_time.slice(0, 5) : '23:59'
  return new Date(`${task.due_date}T${time}`)
}

function dueBucket(task: Task, now: Date): string {
  const due = dueDateAsDate(task)
  if (!due) return 'no_due'
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfToday.getDate() + 1)
  const startOfWeekEnd = new Date(startOfToday)
  startOfWeekEnd.setDate(startOfToday.getDate() + 7)

  if (due < startOfToday) return 'overdue'
  if (due < startOfTomorrow) return 'today'
  if (due < new Date(startOfTomorrow.getTime() + 86400_000)) return 'tomorrow'
  if (due < startOfWeekEnd) return 'this_week'
  return 'later'
}

type Row = { kind: 'header'; id: string; label: string } | { kind: 'row'; id: string; task: Task }

const TasksPage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { tasks, loading, create, setStatus, remove, refresh } = useTasks()
  useTasksRealtime(user?.id, refresh)

  const [tab, setTab] = useState<TabKey>('assigned')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [filtersReady, setFiltersReady] = useState(false)
  const [filterPanel, setFilterPanel] = useState<null | 'status' | 'project' | 'assignee'>(null)
  const filterPanelRef = useRef<HTMLDivElement | null>(null)

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])

  useEffect(() => {
    if (!user) return
    setFilters(loadFilters(user.id))
    setFiltersReady(true)
  }, [user])

  useEffect(() => {
    if (user && filtersReady) saveFilters(user.id, filters)
  }, [user, filters, filtersReady])

  useEffect(() => {
    fetchProjectOptions().then(setProjects).catch(() => setProjects([]))
    fetchTaskUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    if (!filterPanel) return
    const handler = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterPanel(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterPanel])

  const { assigned, created, privateTasks } = useMemo(() => {
    const assignedList: Task[] = []
    const createdList: Task[] = []
    const privateList: Task[] = []
    if (!user) return { assigned: assignedList, created: createdList, privateTasks: privateList }
    tasks.forEach(tk => {
      if (tk.is_private && tk.created_by === user.id) privateList.push(tk)
      else if (tk.created_by === user.id) createdList.push(tk)
      if (!tk.is_private && tk.assignees?.some(a => a.user_id === user.id)) assignedList.push(tk)
    })
    return { assigned: assignedList, created: createdList, privateTasks: privateList }
  }, [tasks, user])

  const baseList = tab === 'assigned' ? assigned : tab === 'created' ? created : privateTasks

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach(p => m.set(p.id, p.name))
    return m
  }, [projects])

  const visibleTasks = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    let list = baseList.filter(tk => {
      if (!filters.showCompleted && tk.status === 'done') return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(tk.status)) return false
      if (filters.projectId && tk.project_id !== filters.projectId) return false
      if (filters.assigneeIds.length > 0) {
        const ids = new Set([tk.created_by, ...(tk.assignees?.map(a => a.user_id) || [])])
        if (!filters.assigneeIds.some(id => ids.has(id))) return false
      }
      if (q) {
        const haystack = `${tk.title} ${tk.description}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      if (filters.sort === 'title') return a.title.localeCompare(b.title)
      if (filters.sort === 'created') return b.created_at.localeCompare(a.created_at)
      const ad = dueDateAsDate(a)?.getTime() ?? Number.POSITIVE_INFINITY
      const bd = dueDateAsDate(b)?.getTime() ?? Number.POSITIVE_INFINITY
      return ad - bd
    })

    return list
  }, [baseList, filters])

  const grouped = useMemo<Array<{ label: string; key: string; items: Task[] }>>(() => {
    if (filters.group === 'none') {
      return [{ label: '', key: 'all', items: visibleTasks }]
    }
    const now = new Date()
    const map = new Map<string, Task[]>()
    const order: string[] = []
    const labelFor = (key: string): string => {
      if (filters.group === 'project') {
        if (key === '__none__') return t('tasks.group.no_project')
        return projectNameById.get(key) || key
      }
      if (filters.group === 'status') return t(`tasks.status.${key}`)
      if (filters.group === 'due') return t(`tasks.group.due_bucket.${key}`)
      return key
    }
    visibleTasks.forEach(tk => {
      let key: string
      if (filters.group === 'project') key = tk.project_id || '__none__'
      else if (filters.group === 'status') key = tk.status
      else key = dueBucket(tk, now)
      if (!map.has(key)) {
        map.set(key, [])
        order.push(key)
      }
      map.get(key)!.push(tk)
    })
    return order.map(key => ({ key, label: labelFor(key), items: map.get(key)! }))
  }, [visibleTasks, filters.group, projectNameById, t])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    grouped.forEach(g => {
      if (g.label) out.push({ kind: 'header', id: `h:${g.key}`, label: g.label })
      g.items.forEach(tk => out.push({ kind: 'row', id: tk.id, task: tk }))
    })
    return out
  }, [grouped])

  const scrollerRef = useRef<HTMLDivElement>(null)
  const virtualize = rows.length > VIRTUALIZE_THRESHOLD
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: index => (rows[index]?.kind === 'header' ? HEADER_HEIGHT : ROW_HEIGHT),
    overscan: 8,
  })

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(pendingDelete)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleCycleStatus = useCallback(
    async (next: Task) => {
      const original = tasks.find(tk => tk.id === next.id)
      if (!original) return
      await setStatus(original, next.status)
    },
    [tasks, setStatus],
  )

  const patchFilters = (patch: Partial<Filters>) => setFilters(prev => ({ ...prev, ...patch }))

  const activeFilterCount =
    filters.statuses.length + (filters.projectId ? 1 : 0) + filters.assigneeIds.length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tasks.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('tasks.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('tasks.new_task')}
        </button>
      </div>

      <div className="flex gap-2 mb-3 border-b border-gray-200 dark:border-gray-700">
        <TabBtn active={tab === 'assigned'} onClick={() => setTab('assigned')} icon={<Inbox className="w-4 h-4" />} label={t('tasks.tabs.assigned')} count={assigned.length} />
        <TabBtn active={tab === 'created'} onClick={() => setTab('created')} icon={<Send className="w-4 h-4" />} label={t('tasks.tabs.created')} count={created.length} />
        <TabBtn active={tab === 'private'} onClick={() => setTab('private')} icon={<Lock className="w-4 h-4" />} label={t('tasks.tabs.private')} count={privateTasks.length} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={e => patchFilters({ search: e.target.value })}
            placeholder={t('tasks.toolbar.search_placeholder')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="relative" ref={filterPanel ? filterPanelRef : null}>
          <button
            type="button"
            onClick={() => setFilterPanel(filterPanel ? null : 'status')}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-400"
          >
            {t('tasks.toolbar.filter')}
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px]">{activeFilterCount}</span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${filterPanel ? 'rotate-180' : ''}`} />
          </button>
          {filterPanel && (
            <div className="absolute right-0 z-30 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">{t('tasks.toolbar.status')}</div>
                <div className="flex flex-wrap gap-1">
                  {STATUS_VALUES.map(s => {
                    const active = filters.statuses.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          patchFilters({
                            statuses: active
                              ? filters.statuses.filter(x => x !== s)
                              : [...filters.statuses, s],
                          })
                        }
                        className={`px-2 py-1 text-xs rounded-full border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}
                      >
                        {t(`tasks.status.${s}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">{t('tasks.toolbar.project')}</div>
                <select
                  value={filters.projectId ?? ''}
                  onChange={e => patchFilters({ projectId: e.target.value || null })}
                  className="w-full text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">{t('tasks.toolbar.any_project')}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">{t('tasks.toolbar.assignees')}</div>
                <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                  {users.map(u => {
                    const active = filters.assigneeIds.includes(u.id)
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center gap-2 px-2 py-1 text-sm cursor-pointer ${active ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() =>
                            patchFilters({
                              assigneeIds: active
                                ? filters.assigneeIds.filter(x => x !== u.id)
                                : [...filters.assigneeIds, u.id],
                            })
                          }
                        />
                        <span className="text-gray-800 dark:text-gray-100">{u.username}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => patchFilters({ statuses: [], projectId: null, assigneeIds: [] })}
                  className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <X className="w-3 h-3" /> {t('tasks.toolbar.clear_filters')}
                </button>
              )}
            </div>
          )}
        </div>

        <select
          value={filters.sort}
          onChange={e => patchFilters({ sort: e.target.value as SortKey })}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          title={t('tasks.toolbar.sort')}
        >
          <option value="due">{t('tasks.toolbar.sort_due')}</option>
          <option value="created">{t('tasks.toolbar.sort_created')}</option>
          <option value="title">{t('tasks.toolbar.sort_title')}</option>
        </select>

        <select
          value={filters.group}
          onChange={e => patchFilters({ group: e.target.value as GroupKey })}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          title={t('tasks.toolbar.group_by')}
        >
          <option value="none">{t('tasks.toolbar.group_none')}</option>
          <option value="project">{t('tasks.toolbar.group_project')}</option>
          <option value="status">{t('tasks.toolbar.group_status')}</option>
          <option value="due">{t('tasks.toolbar.group_due')}</option>
        </select>

        <ToggleSwitch
          checked={filters.showCompleted}
          onChange={v => patchFilters({ showCompleted: v })}
          label={t('tasks.toolbar.show_completed')}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('tasks.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <CheckSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{t('tasks.empty')}</p>
        </div>
      ) : virtualize ? (
        <div ref={scrollerRef} className="max-h-[70vh] overflow-y-auto">
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(vItem => {
              const r = rows[vItem.index]
              return (
                <div
                  key={r.id}
                  data-index={vItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  {r.kind === 'header' ? (
                    <div className="px-1 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {r.label}
                    </div>
                  ) : (
                    <div className="py-1">
                      <TaskRow
                        task={r.task}
                        currentUserId={user?.id || ''}
                        projectName={r.task.project_id ? projectNameById.get(r.task.project_id) || null : null}
                        onCycleStatus={handleCycleStatus}
                        onDelete={tk => setPendingDelete(tk)}
                        onClick={tk => setSelected(tk)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(g => (
            <div key={g.key} className="space-y-2">
              {g.label && (
                <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {g.label}
                </div>
              )}
              {g.items.map(tk => (
                <TaskRow
                  key={tk.id}
                  task={tk}
                  currentUserId={user?.id || ''}
                  projectName={tk.project_id ? projectNameById.get(tk.project_id) || null : null}
                  onCycleStatus={handleCycleStatus}
                  onDelete={t2 => setPendingDelete(t2)}
                  onClick={t2 => setSelected(t2)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <TaskModal show={showNew} onClose={() => setShowNew(false)} onCreate={create} />
      <TaskDetail
        task={selected ? tasks.find(tk => tk.id === selected.id) || selected : null}
        onClose={() => setSelected(null)}
        onDelete={async tk => { await remove(tk) }}
        onChanged={refresh}
      />
      <ConfirmDialog
        show={!!pendingDelete}
        title={t('tasks.detail.delete_task_confirm_title')}
        message={t('tasks.detail.delete_task_confirm_message')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

interface TabBtnProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}

const TabBtn: React.FC<TabBtnProps> = ({ active, onClick, icon, label, count }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
  >
    {icon}
    <span>{label}</span>
    <span className={`px-2 py-0.5 rounded-full text-xs ${active ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{count}</span>
  </button>
)

export default TasksPage
