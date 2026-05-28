import { ArrowUpDown, ChevronDown } from 'lucide-react'

export interface SortOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  options: SortOption<T>[]
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}

export default function SortDropdown<T extends string>({ value, options, onChange, className = '', ariaLabel }: Props<T>) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <ArrowUpDown className="w-4 h-4 text-gray-500 dark:text-gray-400 absolute left-2.5 pointer-events-none" />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="pl-8 pr-8 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 absolute right-2.5 pointer-events-none" />
    </div>
  )
}
