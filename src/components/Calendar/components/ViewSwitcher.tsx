import { useTranslation } from 'react-i18next'
import SegmentedControl from '../../ui/SegmentedControl'
import type { CalendarView } from '../hooks/useCalendarPreferences'

interface Props {
  value: CalendarView
  onChange: (view: CalendarView) => void
}

export default function ViewSwitcher({ value, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <SegmentedControl<CalendarView>
      value={value}
      onChange={onChange}
      ariaLabel={t('calendar.view_switcher.label')}
      options={[
        { value: 'day', label: t('calendar.view_switcher.day') },
        { value: 'week', label: t('calendar.view_switcher.week') },
        { value: 'month', label: t('calendar.view_switcher.month') },
        { value: 'agenda', label: t('calendar.view_switcher.agenda') },
      ]}
    />
  )
}
