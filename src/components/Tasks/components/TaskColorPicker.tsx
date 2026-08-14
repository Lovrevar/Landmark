import React from 'react'
import { useTranslation } from 'react-i18next'
import { Ban } from 'lucide-react'
import { COLOR_STYLES, TASK_COLORS } from '../taskColor'
import type { TaskColor } from '../taskColor'

interface Props {
  value: TaskColor | null
  onChange: (color: TaskColor | null) => void
  disabled?: boolean
}

/**
 * Six swatches plus a "no colour" button. Clicking the selected swatch again clears it, so
 * the palette needs no separate reset affordance in the create modal.
 */
const TaskColorPicker: React.FC<Props> = ({ value, onChange, disabled = false }) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TASK_COLORS.map(({ value: color, labelKey }) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected ? null : color)}
            aria-pressed={selected}
            title={t(labelKey)}
            className={`w-7 h-7 rounded-full transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${COLOR_STYLES[color].swatch} ${
              selected
                ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ${COLOR_STYLES[color].ring} scale-110`
                : 'hover:scale-110'
            }`}
          />
        )
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        title={t('tasks.colors.none')}
        className={`w-7 h-7 rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${
          value === null
            ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-gray-400'
            : 'hover:scale-110'
        }`}
      >
        <Ban className="w-4 h-4" />
      </button>
    </div>
  )
}

export default TaskColorPicker
