import React, { useState, useEffect } from 'react'
import Input from '../ui/Input'

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
  className,
  disabled = false,
  min
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      if (value === null || value === undefined || value === 0) {
        setDisplayValue('')
      } else {
        setDisplayValue(hrFormatter.format(value))
      }
    }
  }, [value, isFocused])

  const parse = (val: string): number => {
    if (!val) return 0

    const normalized = val.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(normalized)

    if (isNaN(num)) return 0
    if (min !== undefined && num < min) return min

    return num
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setDisplayValue(inputValue)
    onChange(parse(inputValue))
  }

  const handleFocus = () => {
    setIsFocused(true)
    if (value !== null && value !== undefined && value !== 0) {
      const rawValue = value.toString().replace('.', ',')
      setDisplayValue(rawValue)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (value !== null && value !== undefined && value !== 0) {
      setDisplayValue(hrFormatter.format(value))
    } else {
      setDisplayValue('')
    }
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
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

export function formatCurrencyFlexible(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  return value.toLocaleString('hr-HR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
