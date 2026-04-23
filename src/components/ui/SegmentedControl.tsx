import type { LucideIcon } from 'lucide-react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

interface Props<T extends string> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className = '',
  ariaLabel,
}: Props<T>) {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  const iconClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        'inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600',
        'bg-white dark:bg-gray-800 p-0.5 gap-0.5',
        className,
      ].join(' ')}
    >
      {options.map(opt => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              sizeClasses,
              active
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            {Icon && <Icon className={iconClasses} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
