import React, { useState, useEffect } from 'react'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  className,
  required,
  placeholder = '0,00',
  min = 0,
  max,
  step = 0.01
}) => {
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (value === 0 && displayValue === '') {
      return
    }
    setDisplayValue(formatToDisplay(value))
  }, [value])

  const formatToDisplay = (num: number): string => {
    if (num === 0) return ''
    return num.toFixed(2).replace('.', ',')
  }

  const parseFromDisplay = (str: string): number => {
    if (!str) return 0
    const normalized = str.replace(',', '.')
    const parsed = parseFloat(normalized)
    return isNaN(parsed) ? 0 : parsed
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value

    input = input.replace(/[^\d,]/g, '')

    const commaCount = (input.match(/,/g) || []).length
    if (commaCount > 1) {
      return
    }

    const parts = input.split(',')
    if (parts.length > 1 && parts[1].length > 2) {
      input = parts[0] + ',' + parts[1].substring(0, 2)
    }

    setDisplayValue(input)

    const numValue = parseFromDisplay(input)
    if (min !== undefined && numValue < min) return
    if (max !== undefined && numValue > max) return

    onChange(numValue)
  }

  const handleBlur = () => {
    if (!displayValue) {
      onChange(0)
      return
    }

    const numValue = parseFromDisplay(displayValue)

    if (min !== undefined && numValue < min) {
      setDisplayValue(formatToDisplay(min))
      onChange(min)
      return
    }

    if (max !== undefined && numValue > max) {
      setDisplayValue(formatToDisplay(max))
      onChange(max)
      return
    }

    setDisplayValue(formatToDisplay(numValue))
    onChange(numValue)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (displayValue === '0,00') {
      setDisplayValue('')
    }
    e.target.select()
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={className}
      required={required}
    />
  )
}

export default CurrencyInput
