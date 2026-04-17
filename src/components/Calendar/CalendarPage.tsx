import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalIcon, Clock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchEventsInRange, acknowledgeAllEvents } from './services/calendarService'
import { dispatchCalendarRead } from './hooks/useCalendarNotifications'
import type { CalendarEvent, EventType } from '../../types/tasks'
import MonthView from './MonthView'
import NewEventModal from './NewEventModal'
import EventDetailModal from './EventDetailModal'

const monthName = (d: Date) => d.toLocaleDateString('hr-HR', { month: 'long', year: 'numeric' })

const typeBg: Record<EventType, string> = {
  meeting: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  personal: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  deadline: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  reminder: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200',
}

const CalendarPage: React.FC = () => {
  const { user } = useAuth()
  const [anchor, setAnchor] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const year = anchor.getFullYear()
      const month = anchor.getMonth()
      const from = new Date(year, month - 1, 1).toISOString()
      const to = new Date(year, month + 2, 0, 23, 59, 59).toISOString()
      const data = await fetchEventsInRange(user.id, from, to)
      setEvents(data)
    } finally {
      setLoading(false)
    }
  }, [anchor, user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user) return
    acknowledgeAllEvents(user.id).then(() => dispatchCalendarRead())
  }, [user])

  const todayEvents = useMemo(() => {
    const today = new Date().toDateString()
    return events
      .filter(e => new Date(e.start_at).toDateString() === today)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
  }, [events])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return events.filter(e => new Date(e.start_at).getTime() > now).slice(0, 5)
  }, [events])

  const openDay = (d: Date) => {
    setDefaultDate(d.toISOString().slice(0, 10))
    setShowNew(true)
  }

  const prevMonth = () => setAnchor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setAnchor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const goToday = () => setAnchor(new Date())

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <CalIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kalendar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sastanci, podsjetnici i rokovi</p>
          </div>
        </div>
        <button onClick={() => { setDefaultDate(undefined); setShowNew(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Novi dogadaj
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={goToday} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
            Danas
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white ml-3 capitalize">
            {monthName(anchor)}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {loading ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">Ucitavanje...</div>
          ) : (
            <MonthView
              anchor={anchor}
              events={events}
              onDayClick={openDay}
              onEventClick={setSelected}
            />
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1">
              <Clock className="w-4 h-4" /> Danas
            </h3>
            {todayEvents.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Nema dogadaja</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map(e => (
                  <button key={e.id} onClick={() => setSelected(e)}
                    className={`w-full text-left px-3 py-2 text-xs rounded ${typeBg[e.event_type]}`}>
                    <div className="font-semibold">{e.title}</div>
                    <div className="opacity-75">
                      {new Date(e.start_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(e.end_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Nadolazece</h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Nista u planu</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(e => (
                  <button key={e.id} onClick={() => setSelected(e)}
                    className="w-full text-left py-1 text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {new Date(e.start_at).toLocaleDateString('hr-HR')}, {new Date(e.start_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <NewEventModal show={showNew} onClose={() => setShowNew(false)} onCreated={load} defaultDate={defaultDate} />
      <EventDetailModal event={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  )
}

export default CalendarPage
