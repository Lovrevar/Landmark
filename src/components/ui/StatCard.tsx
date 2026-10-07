import type React from 'react'
import type { LucideIcon } from 'lucide-react'

type StatColorScheme = 'white' | 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'teal' | 'orange'

const containerStyles: Record<StatColorScheme, string> = {
  white: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  blue: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800',
  green: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
  red: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
  gray: 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700',
  teal: 'bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-900/30 border border-teal-200 dark:border-teal-800',
  orange: 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800',
}

const iconBgStyles: Record<StatColorScheme, string> = {
  white: 'bg-blue-100 dark:bg-blue-900/40',
  blue: 'bg-blue-200 dark:bg-blue-800/40',
  green: 'bg-green-200 dark:bg-green-800/40',
  red: 'bg-red-200 dark:bg-red-800/40',
  yellow: 'bg-yellow-200 dark:bg-yellow-800/40',
  gray: 'bg-gray-200 dark:bg-gray-600',
  teal: 'bg-teal-200 dark:bg-teal-800/40',
  orange: 'bg-orange-200 dark:bg-orange-800/40',
}

const labelStyles: Record<StatColorScheme, string> = {
  white: 'text-gray-600 dark:text-gray-400',
  blue: 'text-blue-700 dark:text-blue-400',
  green: 'text-green-700 dark:text-green-400',
  red: 'text-red-700 dark:text-red-400',
  yellow: 'text-yellow-700 dark:text-yellow-400',
  gray: 'text-gray-600 dark:text-gray-400',
  teal: 'text-teal-700 dark:text-teal-400',
  orange: 'text-orange-700 dark:text-orange-400',
}

const valueStyles: Record<StatColorScheme, string> = {
  white: 'text-gray-900 dark:text-white',
  blue: 'text-blue-900 dark:text-blue-100',
  green: 'text-green-900 dark:text-green-100',
  red: 'text-red-900 dark:text-red-100',
  yellow: 'text-yellow-900 dark:text-yellow-100',
  gray: 'text-gray-900 dark:text-white',
  teal: 'text-teal-900 dark:text-teal-100',
  orange: 'text-orange-900 dark:text-orange-100',
}

interface StatCardProps {
  label?: string
  title?: string
  value: string | number
  subtitle?: string
  trend?: string
  icon?: LucideIcon
  color?: StatColorScheme
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// `value` is the largest the figure is drawn (Tailwind's text-lg / text-xl / text-3xl). On a
// narrow card it shrinks from there and, failing that, wraps — see `.stat-card` in index.css.
const sizeConfig = {
  sm: { container: 'p-3', value: '1.125rem', icon: 'w-5 h-5', iconWrap: 'p-1.5' },
  md: { container: 'p-4', value: '1.25rem', icon: 'w-6 h-6', iconWrap: 'p-2' },
  lg: { container: 'p-6', value: '1.875rem', icon: 'w-8 h-8', iconWrap: 'p-3' },
}

export default function StatCard({
  label,
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'white',
  size = 'md',
  className = '',
}: StatCardProps) {
  const displayLabel = label ?? title ?? ''
  const cfg = sizeConfig[size]
  // A browser may break a line between "−" and "€". If a negative amount ever has to wrap, the
  // sign must not be what gets left behind on the line above, so the two are kept together.
  const signPrefix = typeof value === 'string' ? (value.match(/^[\u2212-]€/)?.[0] ?? null) : null

  const classes = [
    'stat-card rounded-xl shadow-sm',
    containerStyles[color],
    cfg.container,
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="stat-card__grid">
        <p className={`stat-card__label text-sm font-medium ${labelStyles[color]} mb-1`}>{displayLabel}</p>
        <p
          className={`stat-card__value font-bold ${valueStyles[color]}`}
          style={{ '--stat-value-size': cfg.value } as React.CSSProperties}
        >
          {signPrefix ? <><span className="whitespace-nowrap">{signPrefix}</span>{String(value).slice(signPrefix.length)}</> : value}
        </p>
        {subtitle && (
          <p className={`stat-card__subtitle text-xs mt-1 ${labelStyles[color]} opacity-75`}>{subtitle}</p>
        )}
        {Icon && (
          <div className={`stat-card__icon ${cfg.iconWrap} ${iconBgStyles[color]} rounded-lg`}>
            <Icon className={`${cfg.icon} ${valueStyles[color]}`} />
          </div>
        )}
      </div>
    </div>
  )
}
