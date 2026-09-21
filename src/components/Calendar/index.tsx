import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalIcon, CheckSquare } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useCalendarPreferences } from './hooks/useCalendarPreferences'
import { useEventsInRange } from './hooks/useEventsInRange'
import { useTasksInRange } from './hooks/useTasksInRange'
import { updateTaskCompleted, deleteTask as deleteTaskSvc } from '../Tasks/services/tasksService'
import TaskDetail from '../Tasks/TaskDetail'
import { acknowledgeOpenedTask } from '../Tasks/hooks/useTasksNotifications'
import { isChecklist } from '../Tasks/subtasks'
import { canEditTask } from '../Tasks/permissions'
import type { Task } from '../../types/tasks'
import type { TaskOccurrence } from './utils/expandTasks'
import {
  createEvent,
  deleteEvent,
  fetchCalendarUsers,
  fetchProjectOptions,
  respondToEvent,
  respondToOccurrence,
  type CalendarUser,
  type ProjectOption,
} from './services/calendarService'
import { fetchBusyBlocks, type BusyBlock } from './services/busyBlocksService'
import { dispatchCalendarRead } from './hooks/useCalendarNotifications'
import { PENDING_WINDOW_DAYS } from './utils/pendingCount'
import { useCalendarReminderToasts } from './hooks/useCalendarReminderToasts'
import type { EventResponse, NewEventInput } from '../../types/tasks'
import type { ExpandedOccurrence } from './utils/recurrence'
import Alert from '../ui/Alert'
import InlineLoadError from '../ui/InlineLoadError'
import MonthView from './MonthView'
import DayView from './views/DayView'
import WeekView from './views/WeekView'
import AgendaView from './views/AgendaView'
import ViewSwitcher from './components/ViewSwitcher'
import CalendarFilterBar from './components/CalendarFilterBar'
import GridSkeleton from './components/GridSkeleton'
import MiniMonth from './components/sidebar/MiniMonth'
import NextUp from './components/sidebar/NextUp'
import AwaitingResponse from './components/sidebar/AwaitingResponse'
import TeamCalendars from './components/sidebar/TeamCalendars'
import { colorForUser } from './utils/teamColors'
import NewEventModal from './NewEventModal'
import EventDetailModal from './EventDetailModal'
import DayEventsModal from './DayEventsModal'
import {
  addDays,
  endOfDay,
  endOfWeek,
  startOfDay,
  startOfWeek,
} from './views/_shared/timeSlots'
import type { SlotSelection } from './views/_shared/useClickToCreate'

function rangeForView(view: string, anchor: Date): { from: Date; to: Date } {
  if (view === 'day') {
    return { from: startOfDay(anchor), to: endOfDay(anchor) }
  }
  if (view === 'week') {
    return { from: startOfWeek(anchor), to: endOfWeek(anchor) }
  }
  if (view === 'agenda') {
    const from = startOfDay(anchor)
    const to = endOfDay(addDays(from, 30))
    return { from, to }
  }
  // month: ±1 month around anchor (month grid spills into prev/next month cells)
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month + 2, 0, 23, 59, 59)
  return { from, to }
}

function toDateInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function minutesToTimeString(minutes: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${pad(h)}:${pad(m)}`
}

const CalendarPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const {
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
  } = useCalendarPreferences()

  useCalendarReminderToasts()

  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [users, setUsers] = useState<CalendarUser[]>([])
  const [projectsError, setProjectsError] = useState(false)
  const [usersError, setUsersError] = useState(false)
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([])
  const [busyError, setBusyError] = useState(false)
  // Bumped by the retry link; the busy-blocks effect keys off it.
  const [busyReload, setBusyReload] = useState(0)

  const { from, to } = useMemo(() => rangeForView(prefs.view, anchor), [prefs.view, anchor])
  const fromIso = useMemo(() => from.toISOString(), [from])
  const toIso = useMemo(() => to.toISOString(), [to])

  const { rawEvents, occurrences, loading, error: eventsError, refresh } = useEventsInRange({
    fromIso,
    toIso,
    activeTypes: prefs.activeTypes,
    activeProjectId: prefs.activeProjectId,
    activeParticipantIds: prefs.activeParticipantIds,
    search,
  })

  // The sidebar's "Awaiting my response" and "Next up" read their own window: the next
  // PENDING_WINDOW_DAYS from today, with no filters — the set the header badge counts. Fed
  // from the grid instead, they changed with every month navigated to and every filter chip,
  // and disagreed with the badge. Fixed at mount (plus a day of slack for a page left open);
  // the widgets themselves cut at the live "now".
  const [sidebarRange] = useState(() => {
    const now = new Date()
    return {
      fromIso: startOfDay(now).toISOString(),
      toIso: endOfDay(addDays(now, PENDING_WINDOW_DAYS + 1)).toISOString(),
    }
  })
  const {
    rawEvents: sidebarRawEvents,
    occurrences: sidebarOccurrences,
    error: sidebarError,
    refresh: refreshSidebar,
  } = useEventsInRange(sidebarRange)

  const refreshEvents = useCallback(async () => {
    await Promise.all([refresh(), refreshSidebar()])
  }, [refresh, refreshSidebar])

  // Task tables key users by auth id; the participant filter holds app
  // user ids — translate before handing it to the tasks overlay.
  const taskParticipantIds = useMemo(
    () =>
      prefs.activeParticipantIds
        .map(id => users.find(u => u.id === id)?.auth_user_id)
        .filter((id): id is string => !!id),
    [prefs.activeParticipantIds, users],
  )

  // Without the user list the participant filter cannot be translated, and mapping it to an
  // empty array reads as "no filter" — which left the task overlay unfiltered while the events
  // beside it stayed filtered. Hide the overlay instead and say why.
  const taskFilterBlocked = usersError && prefs.activeParticipantIds.length > 0

  const { rawTasks, taskOccurrences, error: tasksError, refresh: refreshTasks } = useTasksInRange({
    fromIso,
    toIso,
    enabled: prefs.showTasks && !taskFilterBlocked,
    activeProjectId: prefs.activeProjectId,
    activeParticipantIds: taskParticipantIds,
    search,
  })

  const [showNew, setShowNew] = useState(false)
  const [newDefaultDate, setNewDefaultDate] = useState<string | undefined>(undefined)
  const [newDefaultStart, setNewDefaultStart] = useState<string | undefined>(undefined)
  const [newDefaultEnd, setNewDefaultEnd] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<ExpandedOccurrence | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // `selected` is a snapshot taken at click time. Re-resolve it after every refresh, so the
  // detail modal shows an edit or an RSVP instead of the pre-change copy. A recurring
  // occurrence is identified by its rule-derived start; a one-off event has one occurrence,
  // whose start moves when its time is edited.
  const resolvedSelected = useMemo(() => {
    if (!selected) return null
    const matches = (o: ExpandedOccurrence) =>
      o.event.id === selected.event.id &&
      (!selected.event.recurrence || o.originalStartIso === selected.originalStartIso)
    return occurrences.find(matches) ?? sidebarOccurrences.find(matches) ?? selected
  }, [selected, occurrences, sidebarOccurrences])

  const selectedSourceEvent = useMemo(() => {
    if (!resolvedSelected) return null
    const id = resolvedSelected.event.id
    return rawEvents.find(e => e.id === id) ?? sidebarRawEvents.find(e => e.id === id) ?? null
  }, [resolvedSelected, rawEvents, sidebarRawEvents])

  const resolvedSelectedTask = useMemo(
    () => (selectedTask ? rawTasks.find(t => t.id === selectedTask.id) || selectedTask : null),
    [selectedTask, rawTasks],
  )

  // Opening a task's drawer here marks it read, as it does on the Tasks page. Nothing on the
  // calendar shows the unread dot, so there is no local state to update — only the header badge.
  const openTask = useCallback((task: Task) => {
    setSelectedTask(task)
    void acknowledgeOpenedTask(task, user?.auth_user_id)
  }, [user])

  const handleTaskClick = useCallback((occ: TaskOccurrence) => {
    openTask(occ.task)
  }, [openTask])

  const handleTaskToggle = useCallback(async (occ: TaskOccurrence) => {
    // The pills already disable these cases; this keeps a stray call from reaching the
    // service, which throws for a checklist task.
    if (!user || isChecklist(occ.task) || !canEditTask(occ.task, user.auth_user_id)) return
    try {
      await updateTaskCompleted(occ.task.id, !occ.isDone, user, occ.task.title)
      await refreshTasks()
    } catch {
      toast.error(t('tasks.row.toggle_failed'))
    }
  }, [user, refreshTasks, toast, t])

  // Both option lists used to swallow their failure into an empty array: the project filter
  // then offered nothing, and the participant filter silently changed what the overlay showed.
  const loadProjects = useCallback(async () => {
    try {
      setProjects(await fetchProjectOptions())
      setProjectsError(false)
    } catch (e) {
      console.error('Failed to load calendar project options', e)
      setProjectsError(true)
      toast.error(t('common.projects_load_error'))
    }
  }, [toast, t])

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchCalendarUsers())
      setUsersError(false)
    } catch (e) {
      console.error('Failed to load calendar users', e)
      setUsersError(true)
      toast.error(t('common.users_load_error'))
    }
  }, [toast, t])

  useEffect(() => {
    if (!user) return
    // Recount the header badge now rather than on its next 20-second poll. There is nothing to
    // mark read on the way in: the badge counts invitations awaiting a response, and only an
    // RSVP clears one. (Visiting used to bulk-stamp calendar_event_participants.acknowledged_at,
    // which nothing displays.)
    dispatchCalendarRead()
    void loadProjects()
    void loadUsers()
  }, [user, loadProjects, loadUsers])

  // Fetch busy blocks for enabled team members within the visible range. A failure used to
  // remove the summary card, which reads as "nobody is busy"; it now stays with a note.
  useEffect(() => {
    if (prefs.enabledTeams.length === 0) {
      setBusyBlocks([])
      setBusyError(false)
      return
    }
    let cancelled = false
    fetchBusyBlocks(prefs.enabledTeams, fromIso, toIso)
      .then(data => { if (!cancelled) { setBusyBlocks(data); setBusyError(false) } })
      .catch(e => {
        if (cancelled) return
        console.error('Failed to load team busy blocks', e)
        setBusyBlocks([])
        setBusyError(true)
      })
    return () => { cancelled = true }
  }, [prefs.enabledTeams, fromIso, toIso, busyReload])

  const openNewEvent = useCallback((opts?: { date?: Date; startMinutes?: number; endMinutes?: number }) => {
    setNewDefaultDate(opts?.date ? toDateInputValue(opts.date) : undefined)
    setNewDefaultStart(typeof opts?.startMinutes === 'number' ? minutesToTimeString(opts.startMinutes) : undefined)
    setNewDefaultEnd(typeof opts?.endMinutes === 'number' ? minutesToTimeString(opts.endMinutes) : undefined)
    setShowNew(true)
  }, [])

  const handleSlotSelect = useCallback((selection: SlotSelection) => {
    openNewEvent({
      date: selection.day,
      startMinutes: selection.startMinutes,
      endMinutes: selection.endMinutes,
    })
  }, [openNewEvent])

  // Month-view click on empty cell → create event at 09:00–10:00 of that date
  const handleMonthCellClick = useCallback((date: Date) => {
    openNewEvent({ date, startMinutes: 9 * 60, endMinutes: 10 * 60 })
  }, [openNewEvent])

  const handleCreate = useCallback(async (input: NewEventInput) => {
    if (!user) return
    await createEvent(input, user.id)
    await refreshEvents()
  }, [user, refreshEvents])

  const handleRespond = useCallback(async (
    participantId: string,
    response: EventResponse,
    eventId?: string,
    eventTitle?: string,
  ) => {
    await respondToEvent(participantId, response, eventId, eventTitle)
    await refreshEvents()
  }, [refreshEvents])

  const handleDelete = useCallback(async (eventId: string, eventTitle?: string) => {
    await deleteEvent(eventId, eventTitle)
    await refreshEvents()
  }, [refreshEvents])

  // After anything in the detail modal (RSVP, edit, delete): refetch, and let the header badge
  // recount now rather than on its next 20-second poll.
  const handleEventChanged = useCallback(async () => {
    await refreshEvents()
    dispatchCalendarRead()
  }, [refreshEvents])

  const handleQuickRespond = useCallback(async (
    occurrence: ExpandedOccurrence,
    response: EventResponse,
  ) => {
    if (!user) return
    try {
      await respondToOccurrence(
        occurrence.event.id,
        user.id,
        occurrence.originalStartIso,
        response,
        occurrence.event.title,
      )
    } catch (e) {
      console.error('Failed to respond to calendar occurrence', e)
      toast.error(t('calendar.detail.respond_failed'))
      return
    }
    await refreshEvents()
    dispatchCalendarRead()
  }, [user, refreshEvents, toast, t])

  const busyDays = useMemo(() => {
    const set = new Set<string>()
    occurrences.forEach(o => set.add(o.start.toDateString()))
    return set
  }, [occurrences])

  const teamColors = useMemo(() => {
    const map: Record<string, string> = {}
    users.forEach(u => { map[u.id] = colorForUser(u.id) })
    return map
  }, [users])

  const anchorLabel = useMemo(() => {
    if (prefs.view === 'day') {
      return anchor.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (prefs.view === 'week') {
      const ws = startOfWeek(anchor)
      const we = addDays(ws, 6)
      return `${ws.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return anchor.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })
  }, [prefs.view, anchor, dateLocale])

  const totalBusyHours = useMemo(() => {
    const perUser = new Map<string, number>()
    busyBlocks.forEach(b => {
      const ms = new Date(b.end_at).getTime() - new Date(b.start_at).getTime()
      perUser.set(b.user_id, (perUser.get(b.user_id) || 0) + ms / 3_600_000)
    })
    return perUser
  }, [busyBlocks])

  // A failed range query leaves the *previous* range's events in state, so the grid draws an
  // all-but-empty month that looks complete. The toolbar, filter bar and sidebar stay mounted —
  // an empty range is legitimate on a calendar, so this is an Alert over the grid, not an
  // ErrorState in its place.
  const gridNotices = useMemo(() => {
    const out: string[] = []
    if (eventsError) out.push(t('calendar.load_error.events'))
    if (tasksError) out.push(t('calendar.load_error.tasks'))
    if (taskFilterBlocked && prefs.showTasks) out.push(t('calendar.load_error.task_filter_blocked'))
    return out
  }, [eventsError, tasksError, taskFilterBlocked, prefs.showTasks, t])

  // Whatever the server said, when it said something a person can read.
  const gridErrorDetail = eventsError?.message || tasksError?.message || ''

  const retryGrid = useCallback(() => {
    void refresh()
    void refreshTasks()
    if (usersError) void loadUsers()
  }, [refresh, refreshTasks, usersError, loadUsers])

  const showSkeleton = loading && occurrences.length === 0

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <CalIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('calendar.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('calendar.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => openNewEvent()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('calendar.new_event')}
        </button>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={goNext} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={goToday} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
            {t('calendar.today')}
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white ml-3 capitalize">
            {anchorLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleShowTasks}
            title={prefs.showTasks ? t('calendar.toolbar.hide_tasks') : t('calendar.toolbar.show_tasks')}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
              prefs.showTasks
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            <CheckSquare className="w-4 h-4" />
            {prefs.showTasks ? t('calendar.toolbar.hide_tasks') : t('calendar.toolbar.show_tasks')}
          </button>
          <ViewSwitcher value={prefs.view} onChange={setView} />
        </div>
      </div>

      <CalendarFilterBar
        activeTypes={prefs.activeTypes}
        onToggleType={toggleType}
        activeProjectId={prefs.activeProjectId}
        onChangeProject={setActiveProjectId}
        projects={projects}
        users={users.filter(u => u.id !== user?.id)}
        activeParticipantIds={prefs.activeParticipantIds}
        onChangeParticipants={setActiveParticipantIds}
        search={search}
        onChangeSearch={setSearch}
        projectsLoadFailed={projectsError}
        usersLoadFailed={usersError}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {gridNotices.length > 0 && (
            <Alert variant="error" className="mb-3" title={t('common.load_error_title')}>
              <div className="space-y-1">
                {gridNotices.map(notice => (
                  <p key={notice}>{notice}</p>
                ))}
                {gridErrorDetail && (
                  <p className="text-xs opacity-80">{gridErrorDetail}</p>
                )}
                <button type="button" onClick={retryGrid} className="underline font-medium">
                  {t('common.retry')}
                </button>
              </div>
            </Alert>
          )}
          {showSkeleton ? (
            <GridSkeleton />
          ) : prefs.view === 'day' ? (
            <DayView
              date={anchor}
              occurrences={occurrences}
              taskOccurrences={taskOccurrences}
              onEventClick={setSelected}
              onTaskClick={handleTaskClick}
              onTaskToggle={handleTaskToggle}
              currentUserId={user?.auth_user_id}
              onSlotSelect={handleSlotSelect}
            />
          ) : prefs.view === 'week' ? (
            <WeekView
              anchor={anchor}
              occurrences={occurrences}
              taskOccurrences={taskOccurrences}
              onEventClick={setSelected}
              onTaskClick={handleTaskClick}
              onTaskToggle={handleTaskToggle}
              currentUserId={user?.auth_user_id}
              onSlotSelect={handleSlotSelect}
            />
          ) : prefs.view === 'agenda' ? (
            <AgendaView
              occurrences={occurrences}
              taskOccurrences={taskOccurrences}
              onEventClick={setSelected}
              onTaskClick={handleTaskClick}
              onTaskToggle={handleTaskToggle}
              currentUserId={user?.auth_user_id}
            />
          ) : (
            <MonthView
              anchor={anchor}
              occurrences={occurrences}
              taskOccurrences={taskOccurrences}
              onDayClick={setSelectedDay}
              onEmptyCellClick={handleMonthCellClick}
              onEventClick={setSelected}
              onTaskClick={handleTaskClick}
              onTaskToggle={handleTaskToggle}
              currentUserId={user?.auth_user_id}
            />
          )}
        </div>

        <aside className="space-y-4">
          <MiniMonth anchor={anchor} busyDays={busyDays} onDateClick={jumpTo} />
          <AwaitingResponse
            occurrences={sidebarOccurrences}
            onEventClick={setSelected}
            onQuickRespond={handleQuickRespond}
            loadFailed={!!sidebarError}
            onRetry={() => { void refreshSidebar() }}
          />
          <NextUp
            occurrences={sidebarOccurrences}
            taskOccurrences={prefs.showTasks ? taskOccurrences : []}
            onEventClick={setSelected}
            onTaskClick={handleTaskClick}
            onTaskToggle={handleTaskToggle}
            currentUserId={user?.auth_user_id}
            loadFailed={!!sidebarError}
            onRetry={() => { void refreshSidebar() }}
          />
          <TeamCalendars
            users={users.filter(u => u.id !== user?.id)}
            enabledIds={prefs.enabledTeams}
            onToggle={toggleTeam}
            colors={teamColors}
            loadFailed={usersError}
            onRetry={() => { void loadUsers() }}
          />
          {prefs.enabledTeams.length > 0 && (busyError || busyBlocks.length > 0) && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                {t('calendar.team_calendars.busy_summary')}
              </h3>
              {busyError ? (
                <InlineLoadError
                  message={t('calendar.load_error.busy_blocks')}
                  onRetry={() => setBusyReload(n => n + 1)}
                />
              ) : (
                <div className="space-y-1 text-xs">
                  {Array.from(totalBusyHours.entries()).map(([uid, hours]) => {
                    const u = users.find(x => x.id === uid)
                    return (
                      <div key={uid} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                          <span className={`w-2 h-2 rounded-full ${teamColors[uid]}`} />
                          {/* A raw uuid told the reader nothing; the name simply is not loaded. */}
                          {u?.username || t('common.option_name_unavailable')}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {t('calendar.team_calendars.hours', { count: Math.round(hours) })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <NewEventModal
        show={showNew}
        onClose={() => setShowNew(false)}
        onCreate={handleCreate}
        defaultDate={newDefaultDate}
        defaultStartTime={newDefaultStart}
        defaultEndTime={newDefaultEnd}
      />
      <EventDetailModal
        occurrence={resolvedSelected}
        sourceEvent={selectedSourceEvent}
        projects={projects}
        projectsLoadFailed={projectsError}
        onClose={() => setSelected(null)}
        onRespond={handleRespond}
        onDelete={handleDelete}
        onChanged={handleEventChanged}
      />
      <DayEventsModal
        date={selectedDay}
        occurrences={occurrences}
        taskOccurrences={taskOccurrences}
        onClose={() => setSelectedDay(null)}
        onEventClick={(o) => { setSelectedDay(null); setSelected(o) }}
        onTaskClick={(tOcc) => { setSelectedDay(null); openTask(tOcc.task) }}
        onTaskToggle={handleTaskToggle}
        currentUserId={user?.auth_user_id}
      />
      {resolvedSelectedTask && (
        <TaskDetail
          task={resolvedSelectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={async (tk) => {
            if (!user) return
            await deleteTaskSvc(tk.id, user, tk.title)
            setSelectedTask(null)
            await refreshTasks()
          }}
          onChanged={refreshTasks}
        />
      )}
    </div>
  )
}

export default CalendarPage
