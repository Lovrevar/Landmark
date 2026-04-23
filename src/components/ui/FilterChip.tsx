import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  active: boolean
  onClick: () => void
  icon?: LucideIcon
  dotColor?: string
  count?: number
  children: React.ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export default function FilterChip({
  active,
  onClick,
  icon: Icon,
  dotColor,
  count,
  children,
  size = 'md',
  className = '',
}: Props) {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  const iconClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border transition-colors font-medium',
        sizeClasses,
        active
          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700',
        className,
      ].join(' ')}
    >
      {dotColor && (
        <span
          className={[
            'inline-block rounded-full',
            size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
            dotColor,
          ].join(' ')}
        />
      )}
      {Icon && <Icon className={iconClasses} />}
      <span>{children}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={[
            'ml-0.5 rounded-full font-semibold',
            size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-1.5 py-0.5 text-[11px]',
            active ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  )
}
