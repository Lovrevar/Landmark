import { useTranslation } from 'react-i18next'

const dayNameKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export default function GridSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {dayNameKeys.map(key => (
          <div key={key} className="py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
            {t(`calendar.day_names.${key}`)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[120px] border-r border-b border-gray-200 dark:border-gray-700 p-2"
          >
            <div className="flex justify-end">
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700/60 animate-pulse" />
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-4 rounded bg-gray-100 dark:bg-gray-700/50 animate-pulse" />
              {i % 3 === 0 && <div className="h-4 rounded bg-gray-100 dark:bg-gray-700/40 animate-pulse w-2/3" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
