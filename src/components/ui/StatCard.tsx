import React from 'react'
import type { LucideIcon } from 'lucide-react'

type StatColorScheme = 'white' | 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'teal'

const containerStyles: Record<StatColorScheme, string> = {
  white: 'bg-white border border-gray-200',
  blue: 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200',
  green: 'bg-green-50 border border-green-200',
  red: 'bg-red-50 border border-red-200',
  yellow: 'bg-yellow-50 border border-yellow-200',
  gray: 'bg-gray-50 border border-gray-200',
  teal: 'bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200',
}

const iconBgStyles: Record<StatColorScheme, string> = {
  white: 'bg-blue-100',
  blue: 'bg-blue-200',
  green: 'bg-green-200',
  red: 'bg-red-200',
  yellow: 'bg-yellow-200',
  gray: 'bg-gray-200',
  teal: 'bg-teal-200',
}

const labelStyles: Record<StatColorScheme, string> = {
  white: 'text-gray-600',
  blue: 'text-blue-700',
  green: 'text-green-700',
  red: 'text-red-700',
  yellow: 'text-yellow-700',
  gray: 'text-gray-600',
  teal: 'text-teal-700',
}

const valueStyles: Record<StatColorScheme, string> = {
  white: 'text-gray-900',
  blue: 'text-blue-900',
  green: 'text-green-900',
  red: 'text-red-900',
  yellow: 'text-yellow-900',
  gray: 'text-gray-900',
  teal: 'text-teal-900',
}

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  color?: StatColorScheme
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeConfig = {
  sm: { container: 'p-3', value: 'text-lg', icon: 'w-5 h-5', iconWrap: 'p-1.5' },
  md: { container: 'p-4', value: 'text-xl', icon: 'w-6 h-6', iconWrap: 'p-2' },
  lg: { container: 'p-6', value: 'text-3xl', icon: 'w-8 h-8', iconWrap: 'p-3' },
}

export default function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = 'white',
  size = 'md',
  className = '',
}: StatCardProps) {
  const cfg = sizeConfig[size]

  const classes = [
    'rounded-xl shadow-sm',
    containerStyles[color],
    cfg.container,
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${labelStyles[color]} mb-1`}>{label}</p>
          <p className={`${cfg.value} font-bold ${valueStyles[color]}`}>{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 ${labelStyles[color]} opacity-75`}>{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`${cfg.iconWrap} ${iconBgStyles[color]} rounded-lg flex-shrink-0 ml-3`}>
            <Icon className={`${cfg.icon} ${valueStyles[color]}`} />
          </div>
        )}
      </div>
    </div>
  )
}
