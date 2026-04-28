import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export interface SearchableOption {
  value: string
  label: string
  sublabel?: string
}

interface Props {
  value: string | null
  options: SearchableOption[]
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  clearLabel?: string
  disabled?: boolean
  allowClear?: boolean
  size?: 'sm' | 'md'
}

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  clearLabel,
  disabled,
  allowClear = true,
  size = 'md',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  const selected = useMemo(() => options.find(o => o.value === value) || null, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.sublabel ? o.sublabel.toLowerCase().includes(q) : false)
    )
  }, [options, query])

  const padding = size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-3 py-2 text-sm'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={[
          'w-full flex items-center justify-between gap-2 rounded-lg border',
          'border-gray-300 dark:border-gray-600',
          'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100',
          'hover:border-gray-400 dark:hover:border-gray-500 transition-colors',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
          padding,
        ].join(' ')}
      >
        <span className={selected ? '' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : (placeholder || '—')}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onChange(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null) } }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={clearLabel || 'Clear'}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent focus:outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">—</div>
            ) : (
              filtered.map(o => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={[
                    'w-full px-3 py-2 text-left text-sm flex flex-col',
                    o.value === value
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700',
                  ].join(' ')}
                >
                  <span>{o.label}</span>
                  {o.sublabel && <span className="text-xs text-gray-500 dark:text-gray-400">{o.sublabel}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
