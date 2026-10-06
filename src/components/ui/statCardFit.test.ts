import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

// CASH-17: on a phone, a stat card's amount ran past the edge of its card. The rule for the fix
// is that a money amount may get smaller or wrap, but no digit of it may ever be hidden. These
// checks pin the three parts of that so a later restyle cannot quietly reintroduce clipping.
describe('StatCard value fitting', () => {
  const component = read('src/components/ui/StatCard.tsx')
  const css = read('src/index.css')
  const rule = (selector: string) => {
    const start = css.indexOf(selector + ' {')
    expect(start, selector).toBeGreaterThan(-1)
    return css.slice(start, css.indexOf('}', start))
  }

  it('never truncates or clips the value', () => {
    expect(component).not.toMatch(/\btruncate\b|line-clamp|text-ellipsis|overflow-hidden/)
    // The only nowrap is the two-character "−€" prefix, which cannot overflow anything.
    expect(component.match(/whitespace-nowrap/g)).toHaveLength(1)
    expect(component).toContain('<span className="whitespace-nowrap">{signPrefix}</span>')
    for (const selector of ['.stat-card', '.stat-card__grid', '.stat-card__value']) {
      expect(rule(selector), selector).not.toMatch(/overflow:\s*hidden|text-overflow|white-space:\s*nowrap/)
    }
  })

  it('lets the value shrink with the card, down to a readable floor, and wrap as the last resort', () => {
    const value = rule('.stat-card__value')
    expect(value).toMatch(/font-size:\s*clamp\(0\.8rem,\s*[\d.]+cqi,\s*var\(--stat-value-size/)
    expect(value).toMatch(/overflow-wrap:\s*anywhere/)
    expect(rule('.stat-card')).toMatch(/container-type:\s*inline-size/)
  })

  it('gives the value the full card width on a narrow card', () => {
    const narrow = css.slice(css.indexOf('@container (max-width: 13rem)'))
    expect(narrow.slice(0, narrow.indexOf('}\n}'))).toContain('"value value"')
  })

  it('caps the size at what each card size asks for, so wide cards look as before', () => {
    expect(component).toContain("sm: { container: 'p-3', value: '1.125rem'")
    expect(component).toContain("md: { container: 'p-4', value: '1.25rem'")
    expect(component).toContain("lg: { container: 'p-6', value: '1.875rem'")
    expect(component).toContain("'--stat-value-size': cfg.value")
  })

  it('keeps the minus sign with the euro sign if a negative amount has to wrap', () => {
    const prefix = (value: string) => value.match(/^[\u2212-]€/)?.[0] ?? null
    expect(component).toContain("value.match(/^[\\u2212-]€/)")
    expect(prefix('\u2212€7.088.981,45')).toBe('\u2212€')
    expect(prefix('€1.287.631,05')).toBeNull()
    expect(prefix('4')).toBeNull()
  })
})
