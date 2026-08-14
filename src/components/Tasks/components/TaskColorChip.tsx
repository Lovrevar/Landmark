import React from 'react'
import { useTranslation } from 'react-i18next'
import { COLOR_STYLES, isTaskColor } from '../taskColor'
import type { TaskColor } from '../taskColor'

interface Props {
  color: TaskColor | null
  /** Renders the dot alone, for tight surfaces like the calendar pill. */
  dotOnly?: boolean
}

/**
 * The colour label as it appears next to a deadline. Squared off (rounded-md) and carrying no
 * clock icon on purpose: the deadline pill owns "is this late", and the two must stay apart
 * even when both happen to be red.
 */
const TaskColorChip: React.FC<Props> = ({ color, dotOnly = false }) => {
  const { t } = useTranslation()
  if (!isTaskColor(color)) return null

  const styles = COLOR_STYLES[color]
  const label = t(`tasks.colors.${color}`)

  if (dotOnly) {
    return (
      <span
        className={`flex-shrink-0 w-2 h-2 rounded-full ${styles.dot}`}
        title={label}
      />
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${styles.chipBg} ${styles.chipText}`}
    >
      <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
      {label}
    </span>
  )
}

export default TaskColorChip
