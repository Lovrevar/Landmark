import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  CheckSquare,
  CheckCheck,
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
import { canEditTask } from './permissions'
import { hasUnreadAssignment } from './unread'
import {
  emptyListReason,
  filterTasks,
  partitionTasks,
  tabCount,
  type TaskTabKey,
} from './taskLists'
import Tabs from '../ui/Tabs'
import Button from '../ui/Button'
import SearchInput from '../ui/SearchInput'
import ToggleSwitch from '../ui/ToggleSwitch'
import ConfirmDialog from '../ui/ConfirmDialog'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Alert from '../ui/Alert'
import { useToast } from '../../contexts/ToastContext'
import { toErrorMessage } from '../../lib/errorMessage'
import type { Task } from '../../types/tasks'
import TaskRow from './TaskRow'
import TaskModal from './TaskModal'
import TaskDetail from './TaskDetail'

type TabKey = TaskTabKey

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
  const toast = useToast()
  const {
    tasks,
    loading,
    error,
    dismissError,
    create,
    toggleStatus,
    remove,
    acknowledge,
    acknowledgeAll,
    refresh,
  } = useTasks()
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
  const [projectsError, setProjectsError] = useState(false)

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

  // A failed fetch used to leave every group falling back to the "Bez projekta" header, so a
  // page of several different projects read as several identical "no project" sections.
  const loadProjects = useCallback(async () => {
    try {
      setProjects(await fetchProjectOptions())
      setProjectsError(false)
    } catch (e) {
      console.error('Failed to load task project options', e)
      setProjectsError(true)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const isMine = useCallback((tk: Task) => canEditTask(tk, user?.auth_user_id), [user])

  // Opening a task is what marks it read (the row's blue dot, one off the header badge).
  const openTask = useCallback((tk: Task) => {
    setSelected(tk)
    void acknowledge(tk.id)
  }, [acknowledge])

  const hasUnread = useMemo(
    () => tasks.some(tk => hasUnreadAssignment(tk, user?.auth_user_id)),
    [tasks, user],
  )

  const { all, assigned, created, privateTasks } = useMemo(
    () => partitionTasks(tasks, user?.auth_user_id),
    [tasks, user],
  )

  const baseList =
    tab === 'all' ? all : tab === 'assigned' ? assigned : tab === 'created' ? created : privateTasks

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach(p => m.set(p.id, p.name))
    return m
  }, [projects])

  const groups = useMemo<Group[]>(() => {
    const now = new Date()

    const visible = filterTasks(baseList, { showCompleted: prefs.showCompleted, search })

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
        // A project whose name did not load is not the same thing as no project at all.
        label: projectId
          ? projectNameById.get(projectId) || t('common.option_name_unavailable')
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

  const listEmptyReason = useMemo(
    () => emptyListReason(baseList, { showCompleted: prefs.showCompleted, search }),
    [baseList, prefs.showCompleted, search],
  )

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
    } catch (e) {
      // The dialog stays open, naming the task it could not delete.
      console.error('Failed to delete task', e)
      toast.error(toErrorMessage(e, t('tasks.row.delete_failed')))
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
        color: null,
        assignee_ids: [],
      })
      setQuickAddDrafts(d => ({ ...d, [group.key]: '' }))
    } catch (e) {
      // The typed title stays in the box so the user can retry it.
      console.error('Failed to create task', e)
      toast.error(toErrorMessage(e, t('tasks.modal.create_failed')))
    } finally {
      setQuickAddBusy(null)
    }
  }

  // `toggleStatus` reverts the optimistic flip and rethrows; the checkbox handler used to
  // drop that promise, so the tick just slid back with no explanation.
  const handleToggleDone = async (task: Task) => {
    try {
      await toggleStatus(task)
    } catch (e) {
      console.error('Failed to toggle task', e)
      toast.error(toErrorMessage(e, t('tasks.row.toggle_failed')))
    }
  }

  // Unlike opening one task, this is something the user asked for, so a failure is reported.
  const handleMarkAllRead = async () => {
    try {
      await acknowledgeAll()
    } catch (e) {
      console.error('Failed to mark tasks as read', e)
      toast.error(toErrorMessage(e, t('tasks.mark_all_read_failed')))
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
        onClick={() => { void submitQuickAdd(group) }}
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
            void submitQuickAdd(group)
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
      onToggleDone={tk => { void handleToggleDone(tk) }}
      onDelete={tk => setPendingDelete(tk)}
      onClick={openTask}
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
          // Counts follow "Show completed" — the list's own rule — so a tab can never read 5
          // over "no tasks in this category". They ignore the search box on purpose: a search
          // is transient, and the tabs are how the category is switched.
          { id: 'all', label: t('tasks.tabs.all'), icon: <LayoutList className="w-4 h-4" />, count: tabCount(all, prefs.showCompleted) },
          { id: 'assigned', label: t('tasks.tabs.assigned'), icon: <Inbox className="w-4 h-4" />, count: tabCount(assigned, prefs.showCompleted) },
          { id: 'created', label: t('tasks.tabs.created'), icon: <Send className="w-4 h-4" />, count: tabCount(created, prefs.showCompleted) },
          { id: 'private', label: t('tasks.tabs.private'), icon: <Lock className="w-4 h-4" />, count: tabCount(privateTasks, prefs.showCompleted) },
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
        {/* Here rather than beside "New task": that row has no room for a second button on a
            phone, and this one wraps. Shown only while there is something to clear. */}
        {hasUnread && (
          <Button variant="ghost-primary" size="sm" icon={CheckCheck} onClick={handleMarkAllRead}>
            {t('tasks.mark_all_read')}
          </Button>
        )}
      </div>

      {projectsError && (
        <Alert
          variant="error"
          className="mb-4"
          title={t('common.load_error_title')}
          onDismiss={() => setProjectsError(false)}
        >
          {t('common.projects_load_error')}{' '}
          <button
            type="button"
            onClick={() => { void loadProjects() }}
            className="underline font-medium"
          >
            {t('common.retry')}
          </button>
        </Alert>
      )}

      {error && tasks.length > 0 && (
        <Alert variant="error" className="mb-4" title={t('common.load_error_title')} onDismiss={dismissError}>
          {t('common.load_error_description')}{' '}
          <button type="button" onClick={() => { void refresh() }} className="underline font-medium">
            {t('common.retry')}
          </button>
        </Alert>
      )}

      {loading && tasks.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('tasks.loading')}</div>
      ) : error && tasks.length === 0 ? (
        <ErrorState onRetry={() => { void refresh() }} />
      ) : rows.length === 0 ? (
        listEmptyReason === 'hidden_completed' ? (
          // The category is not empty — everything in it is done and the toggle is off. Saying
          // "no tasks in this category" beside a tab reading 5 was the contradiction.
          <EmptyState
            icon={CheckSquare}
            title={t('tasks.empty_hidden_completed')}
            description={t('tasks.empty_hidden_completed_hint')}
            action={
              <Button variant="secondary" onClick={() => patchPrefs({ showCompleted: true })}>
                {t('tasks.toolbar.show_completed')}
              </Button>
            }
          />
        ) : listEmptyReason === 'no_search_match' ? (
          <EmptyState
            icon={CheckSquare}
            title={t('tasks.empty_search')}
            action={
              <Button variant="secondary" onClick={() => setSearch('')}>
                {t('common.clear')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={CheckSquare}
            title={t('tasks.empty')}
            action={
              <Button icon={Plus} variant="secondary" onClick={() => setShowNew(true)}>
                {t('tasks.new_task')}
              </Button>
            }
          />
        )
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
