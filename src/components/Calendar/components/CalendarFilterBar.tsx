import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import FilterChip from '../../ui/FilterChip'
import SearchableSelect from '../../ui/SearchableSelect'
import type { EventType, TaskUser } from '../../../types/tasks'
import type { ProjectOption } from '../services/calendarService'

interface Props {
  activeTypes: string[]
  onToggleType: (type: string) => void
  activeProjectId: string | null
  onChangeProject: (id: string | null) => void
  projects: ProjectOption[]
  users: TaskUser[]
  activeParticipantIds: string[]
  onChangeParticipants: (ids: string[]) => void
  search: string
  onChangeSearch: (s: string) => void
}

const TYPES: EventType[] = ['meeting', 'personal', 'deadline', 'reminder']

const typeDot: Record<EventType, string> = {
  meeting: 'bg-blue-500',
  personal: 'bg-gray-400',
  deadline: 'bg-red-500',
  reminder: 'bg-amber-500',
}

export default function CalendarFilterBar({
  activeTypes,
  onToggleType,
  activeProjectId,
  onChangeProject,
  projects,
  users,
  activeParticipantIds,
  onChangeParticipants,
  search,
  onChangeSearch,
}: Props) {
  const { t } = useTranslation()

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }))
  const userOptions = users.map(u => ({ value: u.id, label: u.username, sublabel: u.role }))

  const selectedParticipantId = activeParticipantIds[0] || null

  const hasActiveFilters =
    activeTypes.length > 0 ||
    activeProjectId !== null ||
    activeParticipantIds.length > 0 ||
    search.length > 0

  const clearAll = () => {
    activeTypes.forEach(onToggleType)
    onChangeProject(null)
    onChangeParticipants([])
    onChangeSearch('')
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map(type => (
          <FilterChip
            key={type}
            active={activeTypes.includes(type)}
            onClick={() => onToggleType(type)}
            dotColor={typeDot[type]}
            size="sm"
          >
            {t(`calendar.event_type.${type}`)}
          </FilterChip>
        ))}

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

        <div className="w-48">
          <SearchableSelect
            value={activeProjectId}
            options={projectOptions}
            onChange={onChangeProject}
            placeholder={t('calendar.filter.project_any')}
            searchPlaceholder={t('common.search')}
            size="sm"
          />
        </div>

        <div className="w-48">
          <SearchableSelect
            value={selectedParticipantId}
            options={userOptions}
            onChange={v => onChangeParticipants(v ? [v] : [])}
            placeholder={t('calendar.filter.participant_any')}
            searchPlaceholder={t('common.search')}
            size="sm"
          />
        </div>

        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => onChangeSearch(e.target.value)}
            placeholder={t('calendar.filter.search_placeholder')}
            className="w-full pl-8 pr-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> {t('calendar.filter.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
