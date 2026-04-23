import { useTranslation } from 'react-i18next'
import { UsersRound } from 'lucide-react'
import type { TaskUser } from '../../../../types/tasks'
import { colorForUser } from '../../utils/teamColors'

interface Props {
  users: TaskUser[]
  enabledIds: string[]
  onToggle: (userId: string) => void
  colors?: Record<string, string>
}

export default function TeamCalendars({ users, enabledIds, onToggle, colors }: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
        <UsersRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        {t('calendar.team_calendars.title')}
      </h3>
      {users.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('calendar.team_calendars.empty')}</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {users.map(u => {
            const enabled = enabledIds.includes(u.id)
            const color = colors?.[u.id] || colorForUser(u.id)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onToggle(u.id)}
                className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
              >
                <span
                  className={[
                    'w-4 h-4 rounded flex-shrink-0 border-2',
                    enabled ? color : 'bg-transparent border-gray-300 dark:border-gray-600',
                    enabled ? 'border-transparent' : '',
                  ].join(' ')}
                />
                <span className={[
                  'text-sm truncate',
                  enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
                ].join(' ')}>
                  {u.username}
                </span>
                <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {u.role}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
