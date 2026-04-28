import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox, Check, X } from 'lucide-react'
import type { EventResponse, EventType } from '../../../../types/tasks'
import type { ExpandedOccurrence } from '../../utils/recurrence'
import { relativeLabel } from '../../utils/relativeLabel'

interface Props {
  occurrences: ExpandedOccurrence[]
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onQuickRespond: (occurrence: ExpandedOccurrence, response: EventResponse) => Promise<void>
  limit?: number
}

const typeDot: Record<EventType, string> = {
  meeting: 'bg-blue-500',
  personal: 'bg-gray-400',
  deadline: 'bg-red-500',
  reminder: 'bg-amber-500',
}

export default function AwaitingResponse({
  occurrences,
  onEventClick,
  onQuickRespond,
  limit = 10,
}: Props) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const { items, overflow } = useMemo(() => {
    const now = Date.now()
    const pending = occurrences
      .filter(o => o.myResponse === 'pending' && o.start.getTime() >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    return { items: pending.slice(0, limit), overflow: Math.max(0, pending.length - limit) }
  }, [occurrences, limit])

  const now = new Date()

  const handleRespond = async (o: ExpandedOccurrence, response: EventResponse) => {
    if (busyKey) return
    setBusyKey(o.occurrenceKey)
    try {
      await onQuickRespond(o, response)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
        <Inbox className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        {t('calendar.awaiting.title')}
        {items.length > 0 && (
          <span className="ml-auto text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        )}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('calendar.awaiting.empty')}</p>
      ) : (
        <div className="space-y-1">
          {items.map(o => {
            const ev = o.event
            const busy = busyKey === o.occurrenceKey
            return (
              <div
                key={o.occurrenceKey}
                className="group flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onEventClick(o)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${typeDot[ev.event_type]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {ev.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {relativeLabel(o.start, now, t)}
                        <span className="mx-1.5">·</span>
                        {o.start.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                        {', '}
                        {o.start.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRespond(o, 'accepted')}
                    aria-label={t('calendar.awaiting.accept')}
                    title={t('calendar.awaiting.accept')}
                    className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRespond(o, 'declined')}
                    aria-label={t('calendar.awaiting.decline')}
                    title={t('calendar.awaiting.decline')}
                    className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
          {overflow > 0 && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400 pt-1 text-center">
              {t('calendar.awaiting.more', { count: overflow })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
