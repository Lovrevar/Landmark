import { describe, it, expect } from 'vitest'
import { pdfMoney, pdfMoneyCompact, pdfMoneyRounded, winAnsi } from './pdfText'

// Every PDF generator prints money through these three. They take the shared formatters' output
// and swap the locale minus (U+2212) for an ASCII hyphen. When the formatters moved the minus in
// front of the euro sign, the PDFs followed: "-€1.234,50", where they used to print "€-1.234,50".
// Pinned here because a PDF goes to a bank and nobody proofreads the sign.
describe('money in PDFs', () => {
  it('prints a negative amount with a hyphen before the euro sign', () => {
    expect(pdfMoney(-1234.5)).toBe('-€1.234,50')
    expect(pdfMoneyRounded(-1500.6)).toBe('-€1.501')
    expect(pdfMoneyCompact(-372000)).toBe('-€372K')
    expect(pdfMoneyCompact(-2500000)).toBe('-€2,5M')
  })

  it('leaves no locale minus for a WinAnsi font to choke on, and never doubles the sign', () => {
    for (const text of [pdfMoney(-0.01), pdfMoneyRounded(-1), pdfMoneyCompact(-45000)]) {
      expect(text).not.toContain('−')
      expect(text).toMatch(/^-€\d/)
      expect(text.match(/-/g)).toHaveLength(1)
    }
  })

  it('prints positives, zero and missing values as before', () => {
    expect(pdfMoney(1234.5)).toBe('€1.234,50')
    expect(pdfMoney(0)).toBe('€0,00')
    expect(pdfMoney(-0.004)).toBe('€0,00')
    expect(pdfMoney(null)).toBe('—')
    expect(pdfMoneyCompact(45000)).toBe('€45K')
  })

  it('winAnsi only touches the minus sign', () => {
    expect(winAnsi('Račun −€1.234 Đakovo')).toBe('Račun -€1.234 Đakovo')
  })
})
