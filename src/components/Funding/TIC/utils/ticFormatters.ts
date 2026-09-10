export interface LineItemPhaseAmount {
  /**
   * 1-based, matching project_phases.phase_number.
   *
   * Identified by ordinal rather than id because a TIC is authored before the phases exist —
   * and phase_number is already maintained as a contiguous 1..n by renumber_project_phases.
   */
  phase_number: number
  vlastita: number
  kreditna: number
}

export interface LineItem {
  name: string
  vlastita: number
  kreditna: number
  /**
   * Per-phase split of this line.
   *
   * Absent or empty means the cost is NOT phased: it counts once at project level and is
   * attributed to no phase. That is real — in 1908_TIC_Osijek.xlsx, "Vrijednost zemljišta"
   * shows its full €4.000.000 against each of the three phases because the land is bought
   * once and each phase's business case restates it. Summing those columns would overstate
   * the project by €8.087.207.
   *
   * When present, the amounts are expected to sum to `vlastita`/`kreditna`; the UI surfaces a
   * mismatch rather than silently reconciling one.
   */
  phases?: LineItemPhaseAmount[]
  /**
   * Which cost classification this line's money belongs to, so the TIC can drive phase budgets.
   *
   * Stored on the row rather than resolved from `name` at read time: rows are free text the user
   * can rename, add, remove and reorder, so a name-keyed lookup would drift the moment anyone
   * edited a label. `null` means unmapped — the amount is then excluded from the per-
   * classification totals and surfaced as "Neraspoređeno u TIC-u" rather than silently dropped.
   */
  classification_id?: number | null
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
