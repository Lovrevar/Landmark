import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  anchor: Date
  busyDays?: Set<string>  // day keys (toDateString) that have events
  onDateClick: (date: Date) => void
}

const dayNameKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export default function MiniMonth({ anchor, busyDays, onDateClick }: Props) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'

  const [localAnchor, setLocalAnchor] = useState<Date>(anchor)

  // Keep local view in sync when parent anchor crosses a month boundary
  React.useEffect(() => {
    setLocalAnchor(prev =>
      prev.getFullYear() === anchor.getFullYear() && prev.getMonth() === anchor.getMonth()
        ? prev
        : new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    )
  }, [anchor])

  const { cells, monthIdx } = useMemo(() => {
    const year = localAnchor.getFullYear()
    const month = localAnchor.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const start = new Date(year, month, 1 - startOffset)

    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push(d)
    }
    return { cells, monthIdx: month }
  }, [localAnchor])

  const todayStr = new Date().toDateString()
  const anchorStr = anchor.toDateString()

  const monthLabel = localAnchor.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
          {monthLabel}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLocalAnchor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label={t('calendar.mini_month.prev')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setLocalAnchor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label={t('calendar.mini_month.next')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-gray-400 dark:text-gray-500 text-center mb-1">
        {dayNameKeys.map(key => (
          <div key={key}>{t(`calendar.day_names.${key}`).slice(0, 2)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          const key = d.toDateString()
          const inMonth = d.getMonth() === monthIdx
          const isToday = key === todayStr
          const isSelected = key === anchorStr
          const hasEvents = busyDays?.has(key) ?? false
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDateClick(d)}
              className={[
                'aspect-square relative text-xs rounded flex items-center justify-center',
                'transition-colors',
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isToday
                    ? 'text-blue-700 dark:text-blue-300 font-semibold'
                    : inMonth
                      ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50',
              ].join(' ')}
            >
              {d.getDate()}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
