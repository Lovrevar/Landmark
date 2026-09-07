export interface LineItem {
  name: string
  vlastita: number
  kreditna: number
}

export interface ConstructionItem {
  numeral: string
  name: string
  vlastita: number
  kreditna: number
}

export interface ConstructionSection {
  code: string
  name: string
  items: ConstructionItem[]
}

export interface TICTotals {
  vlastita: number
  kreditna: number
}

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export const formatPercentage = (num: number): string => {
  return new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export const calculateRowPercentages = (value: number, total: number): number => {
  if (total === 0) return 0
  return (value / total) * 100
}

export const calculateTotals = (lineItems: LineItem[]): TICTotals => {
  return lineItems.reduce(
    (acc, item) => ({
      vlastita: acc.vlastita + item.vlastita,
      kreditna: acc.kreditna + item.kreditna,
    }),
    { vlastita: 0, kreditna: 0 }
  )
}

/** Subtotal for one GRAĐENJE section — the "Ukupno" row, always derived. */
export const calculateSectionTotals = (section: ConstructionSection): TICTotals => {
  return calculateTotals(section.items)
}

/** Grand total across all GRAĐENJE sections — the "SVEUKUPNO:" row, always derived. */
export const calculateConstructionTotals = (sections: ConstructionSection[]): TICTotals => {
  return sections.reduce<TICTotals>(
    (acc, section) => {
      const sectionTotals = calculateSectionTotals(section)
      return {
        vlastita: acc.vlastita + sectionTotals.vlastita,
        kreditna: acc.kreditna + sectionTotals.kreditna,
      }
    },
    { vlastita: 0, kreditna: 0 }
  )
}

const ROMAN_NUMERALS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

/** 1 -> "I.", 4 -> "IV.", 14 -> "XIV." — used when appending a construction item. */
export const toRomanNumeral = (value: number): string => {
  if (value < 1) return ''
  let remaining = Math.floor(value)
  let result = ''
  for (const [amount, symbol] of ROMAN_NUMERALS) {
    while (remaining >= amount) {
      result += symbol
      remaining -= amount
    }
  }
  return `${result}.`
}

/** 0 -> "A)", 1 -> "B)", 26 -> "AA)" — used when appending a section. */
export const toSectionCode = (index: number): string => {
  if (index < 0) return ''
  let remaining = index
  let result = ''
  do {
    result = String.fromCharCode(65 + (remaining % 26)) + result
    remaining = Math.floor(remaining / 26) - 1
  } while (remaining >= 0)
  return `${result})`
}
