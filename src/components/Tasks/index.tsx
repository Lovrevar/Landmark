import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  CheckSquare,
  Inbox,
  Send,
  Lock,
  LayoutList,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '../../contexts/AuthContext'
import { useTasks } from './hooks/useTasks'
import { useTasksRealtime } from './hooks/useTasksRealtime'
import { fetchProjectOptions, type ProjectOption } from './services/tasksService'
import Tabs from '../ui/Tabs'
import Button from '../ui/Button'
import SearchInput from '../ui/SearchInput'
import ToggleSwitch from '../ui/ToggleSwitch'
import ConfirmDialog from '../ui/ConfirmDialog'
import EmptyState from '../ui/EmptyState'
import type { Task } from '../../types/tasks'
import TaskRow from './TaskRow'
import TaskModal from './TaskModal'
import TaskDetail from './TaskDetail'

type TabKey = 'all' | 'assigned' | 'created' | 'private'

const VIRTUALIZE_THRESHOLD = 100
const ROW_HEIGHT = 78
const HEADER_HEIGHT = 48
const QUICK_ADD_HEIGHT = 56

const NO_PROJECT_KEY = '__none__'

interface ViewPrefs {
  showCompleted: boolean
  collapsed: string[]
}

const DEFAULT_PREFS: ViewPrefs = { showCompleted: true, collapsed: [] }

function prefsKey(userId: string) {
  return `tasks.view.${userId}`
}

function loadPrefs(userId: string): ViewPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(userId))
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<ViewPrefs>
    return { ...DEFAULT_PREFS, ...parsed }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(userId: string, prefs: ViewPrefs) {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

function dueDateAsDate(task: Task): Date | null {
  if (!task.deadline) return null
  const time = task.due_time ? task.due_time.slice(0, 5) : '23:59'
  return new Date(`${task.deadline}T${time}`)
}

interface Group {
  key: string
  projectId: string | null
  label: string
  items: Task[]
  overdueCount: number
}

type Row =
  | { kind: 'header'; id: string; group: Group }
  | { kind: 'quickadd'; id: string; group: Group }
  | { kind: 'row'; id: string; task: Task }

const TasksPage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { tasks, loading, create, toggleStatus, remove, refresh } = useTasks()
  useTasksRealtime(user?.auth_user_id, refresh)

  const [tab, setTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [prefs, setPrefs] = useState<ViewPrefs>(DEFAULT_PREFS)
  const [quickAddDrafts, setQuickAddDrafts] = useState<Record<string, string>>({})
  const [quickAddBusy, setQuickAddBusy] = useState<string | null>(null)

  const [projects, setProjects] = useState<ProjectOption[]>([])

  useEffect(() => {
    if (!user) return
    // one-time cleanup of the pre-rework filter state
    try {
      localStorage.removeItem(`tasks.filters.${user.id}`)
    } catch {
      /* ignore */
    }
    setPrefs(loadPrefs(user.id))
  }, [user])

  const patchPrefs = useCallback(
    (patch: Partial<ViewPrefs>) => {
      setPrefs(prev => {
        const next = { ...prev, ...patch }
        if (user) savePrefs(user.id, next)
        return next
      })
    },
    [user],
  )

  useEffect(() => {
    fetchProjectOptions().then(setProjects).catch(() => setProjects([]))
  }, [])

  const isMine = useCallback(
    (tk: Task) =>
      !!user &&
      (tk.created_by === user.auth_user_id ||
        (tk.assignees || []).some(a => a.assignee_id === user.auth_user_id)),
    [user],
  )

  const { all, assigned, created, privateTasks } = useMemo(() => {
    const allList: Task[] = []
    const assignedList: Task[] = []
    const createdList: Task[] = []
    const privateList: Task[] = []
    if (!user) return { all: allList, assigned: assignedList, created: createdList, privateTasks: privateList }
    tasks.forEach(tk => {
      if (tk.is_private) {
        if (tk.created_by === user.auth_user_id) privateList.push(tk)
        return
      }
      allList.push(tk)
      if (tk.created_by === user.auth_user_id) createdList.push(tk)
      if (tk.assignees?.some(a => a.assignee_id === user.auth_user_id)) assignedList.push(tk)
    })
    return { all: allList, assigned: assignedList, created: createdList, privateTasks: privateList }
  }, [tasks, user])

  const baseList =
    tab === 'all' ? all : tab === 'assigned' ? assigned : tab === 'created' ? created : privateTasks

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach(p => m.set(p.id, p.name))
    return m
  }, [projects])

  const groups = useMemo<Group[]>(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()

    const visible = baseList.filter(tk => {
      if (!prefs.showCompleted && tk.completed) return false
      if (q) {
        const haystack = `${tk.title} ${tk.description}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    const byProject = new Map<string, Task[]>()
    visible.forEach(tk => {
      const key = tk.project_id || NO_PROJECT_KEY
      const list = byProject.get(key) || []
      list.push(tk)
      byProject.set(key, list)
    })

    const sortTasks = (list: Task[]): Task[] => {
      const open = list.filter(tk => !tk.completed)
      const done = list.filter(tk => tk.completed)
      open.sort((a, b) => {
        const ad = dueDateAsDate(a)?.getTime() ?? Number.POSITIVE_INFINITY
        const bd = dueDateAsDate(b)?.getTime() ?? Number.POSITIVE_INFINITY
        if (ad !== bd) return ad - bd
        return b.created_at.localeCompare(a.created_at)
      })
      done.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
      return [...open, ...done]
    }

    const result: Group[] = []
    byProject.forEach((items, key) => {
      const projectId = key === NO_PROJECT_KEY ? null : key
      const sorted = sortTasks(items)
      const overdueCount = sorted.filter(tk => {
        if (tk.completed) return false
        const due = dueDateAsDate(tk)
        return !!due && due.getTime() < now.getTime()
      }).length
      result.push({
        key,
        projectId,
        label: projectId
          ? projectNameById.get(projectId) || t('tasks.group.no_project')
          : t('tasks.group.no_project'),
        items: sorted,
        overdueCount,
      })
    })

    result.sort((a, b) => {
      if (a.projectId === null) return 1
      if (b.projectId === null) return -1
      return a.label.localeCompare(b.label)
    })
    return result
  }, [baseList, search, prefs.showCompleted, projectNameById, t])

  const collapsedSet = useMemo(() => new Set(prefs.collapsed), [prefs.collapsed])
  const showQuickAdd = tab !== 'assigned'

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    groups.forEach(g => {
      out.push({ kind: 'header', id: `h:${g.key}`, group: g })
      if (collapsedSet.has(g.key)) return
      if (showQuickAdd) out.push({ kind: 'quickadd', id: `q:${g.key}`, group: g })
      g.items.forEach(tk => out.push({ kind: 'row', id: tk.id, task: tk }))
    })
    return out
  }, [groups, collapsedSet, showQuickAdd])

  const scrollerRef = useRef<HTMLDivElement>(null)
  const virtualize = rows.length > VIRTUALIZE_THRESHOLD
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: index => {
      const r = rows[index]
      if (r?.kind === 'header') return HEADER_HEIGHT
      if (r?.kind === 'quickadd') return QUICK_ADD_HEIGHT
      return ROW_HEIGHT
    },
    overscan: 8,
  })

  const toggleCollapsed = (key: string) => {
    patchPrefs({
      collapsed: collapsedSet.has(key)
        ? prefs.collapsed.filter(k => k !== key)
        : [...prefs.collapsed, key],
    })
  }

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

  const submitQuickAdd = async (group: Group) => {
    const title = (quickAddDrafts[group.key] || '').trim()
    if (!title || quickAddBusy) return
    setQuickAddBusy(group.key)
    try {
      await create({
        title,
        description: '',
        deadline: null,
        is_private: tab === 'private',
        project_id: group.projectId,
        assignee_ids: [],
      })
      setQuickAddDrafts(d => ({ ...d, [group.key]: '' }))
    } finally {
      setQuickAddBusy(null)
    }
  }

  const renderHeader = (group: Group) => (
    <button
      type="button"
      onClick={() => toggleCollapsed(group.key)}
      className="w-full flex items-center gap-2 px-1 pt-3 pb-1 text-left"
    >
      {collapsedSet.has(group.key) ? (
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
      )}
      <FolderOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <span className="text-base font-semibold text-gray-700 dark:text-gray-200 truncate">
        {group.label}
      </span>
      <span className="px-2 py-0.5 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        {group.items.length}
      </span>
      {group.overdueCount > 0 && (
        <span className="px-2 py-0.5 text-sm rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">
          {t('tasks.group.overdue_count', { count: group.overdueCount })}
        </span>
      )}
    </button>
  )

  const renderQuickAdd = (group: Group) => (
    <div className="flex items-center gap-2 px-1 py-1">
      <button
        type="button"
        onClick={() => submitQuickAdd(group)}
        disabled={quickAddBusy === group.key || !(quickAddDrafts[group.key] || '').trim()}
        className="flex-shrink-0 p-2 -m-2 text-gray-400 enabled:text-blue-600 enabled:hover:text-blue-700 dark:enabled:text-blue-400 dark:enabled:hover:text-blue-300 disabled:cursor-default"
        title={t('tasks.new_task')}
        aria-label={t('tasks.new_task')}
      >
        <Plus className="w-5 h-5" />
      </button>
      <input
        value={quickAddDrafts[group.key] || ''}
        onChange={e => setQuickAddDrafts(d => ({ ...d, [group.key]: e.target.value }))}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submitQuickAdd(group)
          }
        }}
        disabled={quickAddBusy === group.key}
        placeholder={t('tasks.quick_add_placeholder')}
        className="flex-1 px-3 py-2 text-base border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-solid focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
      />
    </div>
  )

  const renderTaskRow = (task: Task) => (
    <TaskRow
      task={task}
      currentUserId={user?.auth_user_id || ''}
      canEdit={isMine(task)}
      onToggleDone={toggleStatus}
      onDelete={tk => setPendingDelete(tk)}
      onClick={tk => setSelected(tk)}
    />
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tasks.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{t('tasks.subtitle')}</p>
          </div>
        </div>
        <Button icon={Plus} size="lg" className="flex-shrink-0" onClick={() => setShowNew(true)}>
          {t('tasks.new_task')}
        </Button>
      </div>

      <Tabs<TabKey>
        className="mb-3"
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'all', label: t('tasks.tabs.all'), icon: <LayoutList className="w-4 h-4" />, count: all.length },
          { id: 'assigned', label: t('tasks.tabs.assigned'), icon: <Inbox className="w-4 h-4" />, count: assigned.length },
          { id: 'created', label: t('tasks.tabs.created'), icon: <Send className="w-4 h-4" />, count: created.length },
          { id: 'private', label: t('tasks.tabs.private'), icon: <Lock className="w-4 h-4" />, count: privateTasks.length },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput
          className="flex-1 min-w-[220px]"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder={t('tasks.toolbar.search_placeholder')}
        />
        <ToggleSwitch
          checked={prefs.showCompleted}
          onChange={v => patchPrefs({ showCompleted: v })}
          label={t('tasks.toolbar.show_completed')}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('tasks.loading')}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t('tasks.empty')}
          action={
            <Button icon={Plus} variant="secondary" onClick={() => setShowNew(true)}>
              {t('tasks.new_task')}
            </Button>
          }
        />
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
                    renderHeader(r.group)
                  ) : r.kind === 'quickadd' ? (
                    renderQuickAdd(r.group)
                  ) : (
                    <div className="py-1">{renderTaskRow(r.task)}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(r =>
            r.kind === 'header' ? (
              <React.Fragment key={r.id}>{renderHeader(r.group)}</React.Fragment>
            ) : r.kind === 'quickadd' ? (
              <React.Fragment key={r.id}>{renderQuickAdd(r.group)}</React.Fragment>
            ) : (
              <div key={r.id} className="py-1">{renderTaskRow(r.task)}</div>
            ),
          )}
        </div>
      )}

      <TaskModal
        show={showNew}
        defaultPrivate={tab === 'private'}
        onClose={() => setShowNew(false)}
        onCreate={create}
      />
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

export default TasksPage
