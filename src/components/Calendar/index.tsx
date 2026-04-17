import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalIcon, Clock } from 'lucide-react'
import { useCalendar } from './hooks/useCalendar'
import type { CalendarEvent, EventType } from '../../types/tasks'
import MonthView from './MonthView'
import NewEventModal from './NewEventModal'
import EventDetailModal from './EventDetailModal'
import DayEventsModal from './DayEventsModal'

const typeBg: Record<EventType, string> = {
  meeting: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  personal: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  deadline: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  reminder: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200',
}

const CalendarPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const {
    anchor,
    events,
    loading,
    todayEvents,
    upcoming,
    create,
    respond,
    remove,
    prevMonth,
    nextMonth,
    goToday,
    refresh,
  } = useCalendar()

  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthLabel = anchor.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale)

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
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> {t('calendar.new_event')}
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
            {t('calendar.today')}
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white ml-3 capitalize">
            {monthLabel}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {loading ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('calendar.loading')}</div>
          ) : (
            <MonthView
              anchor={anchor}
              events={events}
              onDayClick={setSelectedDay}
              onEventClick={setSelected}
            />
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1">
              <Clock className="w-4 h-4" /> {t('calendar.today')}
            </h3>
            {todayEvents.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('calendar.no_events_today')}</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map(e => (
                  <button key={e.id} onClick={() => setSelected(e)}
                    className={`w-full text-left px-3 py-2 text-xs rounded ${typeBg[e.event_type]}`}>
                    <div className="font-semibold">{e.title}</div>
                    <div className="opacity-75">
                      {fmtTime(e.start_at)} - {fmtTime(e.end_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('calendar.upcoming')}</h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('calendar.no_upcoming')}</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(e => (
                  <button key={e.id} onClick={() => setSelected(e)}
                    className="w-full text-left py-1 text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {fmtDate(e.start_at)}, {fmtTime(e.start_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <NewEventModal show={showNew} onClose={() => setShowNew(false)} onCreate={create} />
      <EventDetailModal
        event={selected}
        onClose={() => setSelected(null)}
        onRespond={respond}
        onDelete={remove}
        onChanged={refresh}
      />
      <DayEventsModal
        date={selectedDay}
        events={events}
        onClose={() => setSelectedDay(null)}
        onEventClick={(e) => { setSelectedDay(null); setSelected(e) }}
      />
    </div>
  )
}

export default CalendarPage
