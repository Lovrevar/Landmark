import React, { useState, useEffect } from 'react'

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
  min?: string
  max?: string
}

const DateInput: React.FC<DateInputProps> = ({ value, onChange, className, required, min, max }) => {
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (value) {
      setDisplayValue(formatToDisplay(value))
    } else {
      setDisplayValue('')
    }
  }, [value])

  const formatToDisplay = (isoDate: string): string => {
    if (!isoDate) return ''
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
  }

  const formatToISO = (displayDate: string): string => {
    const cleaned = displayDate.replace(/\D/g, '')
    if (cleaned.length !== 8) return ''

    const day = cleaned.substring(0, 2)
    const month = cleaned.substring(2, 4)
    const year = cleaned.substring(4, 8)

    const dayNum = parseInt(day)
    const monthNum = parseInt(month)
    const yearNum = parseInt(year)

    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
      return ''
    }

    return `${year}-${month}-${day}`
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, '')

    if (input.length > 8) {
      input = input.substring(0, 8)
    }

    let formatted = ''
    if (input.length > 0) {
      formatted = input.substring(0, 2)
      if (input.length >= 3) {
        formatted += '/' + input.substring(2, 4)
      }
      if (input.length >= 5) {
        formatted += '/' + input.substring(4, 8)
      }
    }

    setDisplayValue(formatted)

    if (input.length === 8) {
      const isoDate = formatToISO(input)
      if (isoDate) {
        onChange(isoDate)
      }
    } else if (input.length === 0) {
      onChange('')
    }
  }

  const handleBlur = () => {
    if (displayValue) {
      const isoDate = formatToISO(displayValue)
      if (isoDate) {
        onChange(isoDate)
        setDisplayValue(formatToDisplay(isoDate))
      } else {
        setDisplayValue('')
        onChange('')
      }
    }
  }

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="DD/MM/YYYY"
      className={className}
      required={required}
      maxLength={10}
    />
  )
}

export default DateInput
