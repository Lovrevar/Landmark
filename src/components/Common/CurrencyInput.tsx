import React from 'react'

interface CurrencyInputProps {
  value: number | null | undefined
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  min?: number
}

const hrFormatter = new Intl.NumberFormat('hr-HR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  disabled = false,
  min
}: CurrencyInputProps) {
  const format = (val: number | null | undefined): string => {
    if (val === null || val === undefined || val === 0) return ''
    return hrFormatter.format(val)
  }

  const parse = (val: string): number => {
    if (!val) return 0

    const normalized = val.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(normalized)

    if (isNaN(num)) return 0
    if (min !== undefined && num < min) return min

    return num
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={format(value)}
      onChange={(e) => onChange(parse(e.target.value))}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  )
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0,00'
  return hrFormatter.format(value)
}
