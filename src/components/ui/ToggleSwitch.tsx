interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  id?: string
}

export default function ToggleSwitch({ checked, onChange, label, description, disabled, id }: Props) {
  const toggleId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)
  const track = checked
    ? 'bg-blue-600'
    : 'bg-gray-300 dark:bg-gray-600'
  const knob = checked ? 'translate-x-4' : 'translate-x-0.5'

  return (
    <label
      htmlFor={toggleId}
      className={[
        'flex items-center gap-3 cursor-pointer select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
          track,
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
            'mt-0.5',
            knob,
          ].join(' ')}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm text-gray-900 dark:text-gray-100">{label}</span>}
          {description && <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>}
        </span>
      )}
    </label>
  )
}
