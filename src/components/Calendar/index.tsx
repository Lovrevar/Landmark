import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalIcon, CheckSquare } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCalendarPreferences } from './hooks/useCalendarPreferences'
import { useEventsInRange } from './hooks/useEventsInRange'
import { useTasksInRange } from './hooks/useTasksInRange'
import { updateTaskStatus, deleteTask as deleteTaskSvc } from '../Tasks/services/tasksService'
import TaskDetail from '../Tasks/TaskDetail'
import type { Task } from '../../types/tasks'
import type { TaskOccurrence } from './utils/expandTasks'
import {
  acknowledgeAllEvents,
  createEvent,
  deleteEvent,
  fetchProjectOptions,
  respondToEvent,
  respondToOccurrence,
  type ProjectOption,
} from './services/calendarService'
import { fetchBusyBlocks, type BusyBlock } from './services/busyBlocksService'
import { fetchTaskUsers } from '../Tasks/services/tasksService'
import { dispatchCalendarRead } from './hooks/useCalendarNotifications'
import { useCalendarReminderToasts } from './hooks/useCalendarReminderToasts'
import type { EventResponse, NewEventInput, TaskUser } from '../../types/tasks'
import type { ExpandedOccurrence } from './utils/recurrence'
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
  const [users, setUsers] = useState<TaskUser[]>([])
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([])

  const { from, to } = useMemo(() => rangeForView(prefs.view, anchor), [prefs.view, anchor])
  const fromIso = useMemo(() => from.toISOString(), [from])
  const toIso = useMemo(() => to.toISOString(), [to])

  const { occurrences, loading, refresh } = useEventsInRange({
    fromIso,
    toIso,
    activeTypes: prefs.activeTypes,
    activeProjectId: prefs.activeProjectId,
    activeParticipantIds: prefs.activeParticipantIds,
    search,
  })

  const { rawTasks, taskOccurrences, refresh: refreshTasks } = useTasksInRange({
    fromIso,
    toIso,
    enabled: prefs.showTasks,
    activeProjectId: prefs.activeProjectId,
    activeParticipantIds: prefs.activeParticipantIds,
    search,
  })

  const [showNew, setShowNew] = useState(false)
  const [newDefaultDate, setNewDefaultDate] = useState<string | undefined>(undefined)
  const [newDefaultStart, setNewDefaultStart] = useState<string | undefined>(undefined)
  const [newDefaultEnd, setNewDefaultEnd] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<ExpandedOccurrence | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const resolvedSelectedTask = useMemo(
    () => (selectedTask ? rawTasks.find(t => t.id === selectedTask.id) || selectedTask : null),
    [selectedTask, rawTasks],
  )

  const handleTaskClick = useCallback((occ: TaskOccurrence) => {
    setSelectedTask(occ.task)
  }, [])

  const handleTaskToggle = useCallback(async (occ: TaskOccurrence) => {
    if (!user) return
    const nextStatus = occ.isDone ? 'todo' : 'done'
    await updateTaskStatus(occ.task.id, nextStatus, user.id, user.role, occ.task.title)
    await refreshTasks()
  }, [user, refreshTasks])

  useEffect(() => {
    if (!user) return
    acknowledgeAllEvents(user.id).then(() => dispatchCalendarRead())
    Promise.all([
      fetchProjectOptions().then(setProjects).catch(() => setProjects([])),
      fetchTaskUsers().then(setUsers).catch(() => setUsers([])),
    ])
  }, [user])

  // Fetch busy blocks for enabled team members within the visible range
  useEffect(() => {
    if (prefs.enabledTeams.length === 0) {
      setBusyBlocks([])
      return
    }
    let cancelled = false
    fetchBusyBlocks(prefs.enabledTeams, fromIso, toIso)
      .then(data => { if (!cancelled) setBusyBlocks(data) })
      .catch(() => { if (!cancelled) setBusyBlocks([]) })
    return () => { cancelled = true }
  }, [prefs.enabledTeams, fromIso, toIso])

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
    await refresh()
  }, [user, refresh])

  const handleRespond = useCallback(async (
    participantId: string,
    response: EventResponse,
    eventId?: string,
    eventTitle?: string,
  ) => {
    await respondToEvent(participantId, response, eventId, eventTitle)
    await refresh()
  }, [refresh])

  const handleDelete = useCallback(async (eventId: string, eventTitle?: string) => {
    await deleteEvent(eventId, eventTitle)
    await refresh()
  }, [refresh])

  const handleQuickRespond = useCallback(async (
    occurrence: ExpandedOccurrence,
    response: EventResponse,
  ) => {
    if (!user) return
    await respondToOccurrence(
      occurrence.event.id,
      user.id,
      occurrence.originalStartIso,
      response,
      occurrence.event.title,
    )
    await refresh()
  }, [user, refresh])

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
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
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
              onSlotSelect={handleSlotSelect}
            />
          ) : prefs.view === 'agenda' ? (
            <AgendaView
              occurrences={occurrences}
              taskOccurrences={taskOccurrences}
              onEventClick={setSelected}
              onTaskClick={handleTaskClick}
              onTaskToggle={handleTaskToggle}
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
            />
          )}
        </div>

        <aside className="space-y-4">
          <MiniMonth anchor={anchor} busyDays={busyDays} onDateClick={jumpTo} />
          <AwaitingResponse
            occurrences={occurrences}
            onEventClick={setSelected}
            onQuickRespond={handleQuickRespond}
          />
          <NextUp
            occurrences={occurrences}
            taskOccurrences={prefs.showTasks ? taskOccurrences : []}
            onEventClick={setSelected}
            onTaskClick={handleTaskClick}
          />
          <TeamCalendars
            users={users.filter(u => u.id !== user?.id)}
            enabledIds={prefs.enabledTeams}
            onToggle={toggleTeam}
            colors={teamColors}
          />
          {prefs.enabledTeams.length > 0 && busyBlocks.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                {t('calendar.team_calendars.busy_summary')}
              </h3>
              <div className="space-y-1 text-xs">
                {Array.from(totalBusyHours.entries()).map(([uid, hours]) => {
                  const u = users.find(x => x.id === uid)
                  return (
                    <div key={uid} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <span className={`w-2 h-2 rounded-full ${teamColors[uid]}`} />
                        {u?.username || uid}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {t('calendar.team_calendars.hours', { count: Math.round(hours) })}
                      </span>
                    </div>
                  )
                })}
              </div>
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
        occurrence={selected}
        projects={projects}
        onClose={() => setSelected(null)}
        onRespond={handleRespond}
        onDelete={handleDelete}
        onChanged={refresh}
      />
      <DayEventsModal
        date={selectedDay}
        occurrences={occurrences}
        taskOccurrences={taskOccurrences}
        onClose={() => setSelectedDay(null)}
        onEventClick={(o) => { setSelectedDay(null); setSelected(o) }}
        onTaskClick={(tOcc) => { setSelectedDay(null); setSelectedTask(tOcc.task) }}
      />
      {resolvedSelectedTask && (
        <TaskDetail
          task={resolvedSelectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={async (tk) => {
            if (!user) return
            await deleteTaskSvc(tk.id, user.id, user.role, tk.title)
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
