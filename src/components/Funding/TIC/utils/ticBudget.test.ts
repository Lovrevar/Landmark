import { describe, it, expect } from 'vitest'
import {
  totalsByClassification, ticGrandTotal, remainingFromTIC, lineItemTotal,
  phaseTotals, budgetMatrix, phaseClassificationTotals,
  phaseSplitCheck, hasPhaseSplitMismatch, ticPhaseCount, normalizePhaseNumbers
} from './ticBudget'
import { calculateTotals, LineItem } from './ticFormatters'

const line = (name: string, vlastita: number, kreditna: number, classification_id?: number | null): LineItem =>
  ({ name, vlastita, kreditna, classification_id })

// Mala Savska Opatovina as stored in production, with the default mapping applied.
// Classification ids follow the seed order: 1 zemljiste, 2 priprema, 3 izgradnja,
// 4 opremanje, 5 kontrola, 6 financiranje, 7 nepredviđeni.
const MALA_SAVSKA: LineItem[] = [
  line('Priprema projekta', 17526, 0, 2),
  line('Vrijednost zemljišta', 380750, 0, 1),
  line('Porez na promet nekretnina', 0, 0, 1),
  line('Projektna dokumentacija, geodetske usluge', 38100, 0, 2),
  line('Komunalni i vodni doprinos', 65574, 0, 2),
  line('Priključci', 0, 92150, 2),
  line('Unutarnje uređenje', 0, 0, 3),
  line('Građenje', 212586.86, 1913281.7, 3),
  line('Opremanje (namještaj, bijela tehnika)', 0, 0, 4),
  line('Stručni nadzor', 0, 46253.4, 5),
  line('Konzalting', 26500, 0, 5),
  line('Posredovanje, marketing, osiguranje', 0, 45000, 6),
  line('Financijski nadzor', 0, 8500, 6),
  line('Financiranje', 0, 0, 6),
  line('Uknjižba, etažiranje, uporabna dozvola', 3048, 0, 5),
  line('Nepredviđeni troškovi', 0, 0, 7),
]

describe('lineItemTotal', () => {
  it('is own funds plus credit', () => {
    expect(lineItemTotal(line('x', 100, 250))).toBe(350)
  })
})

describe('ticGrandTotal', () => {
  it('reproduces the production total for Mala Savska', () => {
    expect(ticGrandTotal(MALA_SAVSKA)).toBeCloseTo(2849269.96, 2)
  })

  it('agrees with calculateTotals, so the two never drift apart', () => {
    const { vlastita, kreditna } = calculateTotals(MALA_SAVSKA)
    expect(ticGrandTotal(MALA_SAVSKA)).toBeCloseTo(vlastita + kreditna, 6)
  })

  it('is zero for an empty or all-zero TIC', () => {
    expect(ticGrandTotal([])).toBe(0)
    expect(ticGrandTotal([line('a', 0, 0, 1)])).toBe(0)
  })
})

describe('totalsByClassification', () => {
  it('reproduces the production per-classification split for Mala Savska', () => {
    const { byClassification, unmapped, total } = totalsByClassification(MALA_SAVSKA)
    expect(byClassification.get(1)).toBeCloseTo(380750, 2)      // Zemljište
    expect(byClassification.get(2)).toBeCloseTo(213350, 2)      // Priprema i razvoj
    expect(byClassification.get(3)).toBeCloseTo(2125868.56, 2)  // Izgradnja i uređenje
    expect(byClassification.get(4)).toBeCloseTo(0, 2)           // Opremanje
    expect(byClassification.get(5)).toBeCloseTo(75801.4, 2)     // Kontrola
    expect(byClassification.get(6)).toBeCloseTo(53500, 2)       // Financiranje i nadzor
    expect(byClassification.get(7)).toBeCloseTo(0, 2)           // Nepredviđeni troškovi
    expect(unmapped).toBe(0)
    expect(total).toBeCloseTo(2849269.96, 2)
  })

  it('holds the invariant: mapped + unmapped === total', () => {
    const items = [line('a', 100, 0, 1), line('b', 50, 25, 2), line('c', 300, 0, null), line('d', 7, 3)]
    const { byClassification, unmapped, total } = totalsByClassification(items)
    const mapped = [...byClassification.values()].reduce((s, v) => s + v, 0)
    expect(mapped + unmapped).toBeCloseTo(total, 6)
    expect(total).toBe(485)
  })

  it('collects unclassified rows rather than dropping or guessing them', () => {
    const { byClassification, unmapped } = totalsByClassification([
      line('mapped', 100, 0, 1),
      line('user added', 250, 0, null),
      line('also user added', 0, 40),
    ])
    expect(unmapped).toBe(290)
    expect(byClassification.size).toBe(1)
    expect(byClassification.get(1)).toBe(100)
  })

  it('sums several rows into the same classification', () => {
    const { byClassification } = totalsByClassification([
      line('Vrijednost zemljišta', 380750, 0, 1),
      line('Porez na promet nekretnina', 12000, 0, 1),
    ])
    expect(byClassification.get(1)).toBe(392750)
  })

  it('is empty for no line items', () => {
    const { byClassification, unmapped, total } = totalsByClassification([])
    expect(byClassification.size).toBe(0)
    expect(unmapped).toBe(0)
    expect(total).toBe(0)
  })

  it('keeps a classification that is planned at zero, so it still shows as planned', () => {
    const { byClassification } = totalsByClassification([line('Opremanje', 0, 0, 4)])
    expect(byClassification.has(4)).toBe(true)
    expect(byClassification.get(4)).toBe(0)
  })
})

describe('remainingFromTIC', () => {
  const totals = totalsByClassification([
    line('Zemljište', 400, 0, 1),
    line('Građenje', 1000, 0, 3),
  ])

  it('gives the whole plan when no phase has taken anything', () => {
    const remaining = remainingFromTIC(totals, [], 'ph1')
    expect(remaining.get(1)).toBe(400)
    expect(remaining.get(3)).toBe(1000)
  })

  it('subtracts what other phases already hold', () => {
    const remaining = remainingFromTIC(
      totals,
      [{ phase_id: 'ph2', classification_id: 3, budget_allocated: 250 }],
      'ph1'
    )
    expect(remaining.get(3)).toBe(750)
    expect(remaining.get(1)).toBe(400)
  })

  it('ignores what the target phase itself holds, so re-filling is idempotent', () => {
    // Pressing "Popuni iz TIC-a" twice must give the same numbers, not subtract its own fill.
    const existing = [{ phase_id: 'ph1', classification_id: 3, budget_allocated: 1000 }]
    expect(remainingFromTIC(totals, existing, 'ph1').get(3)).toBe(1000)
  })

  it('clamps at zero when other phases have over-committed', () => {
    const remaining = remainingFromTIC(
      totals,
      [{ phase_id: 'ph2', classification_id: 1, budget_allocated: 999 }],
      'ph1'
    )
    expect(remaining.get(1)).toBe(0)
  })

  it('sums across several other phases', () => {
    const remaining = remainingFromTIC(
      totals,
      [
        { phase_id: 'ph2', classification_id: 3, budget_allocated: 300 },
        { phase_id: 'ph3', classification_id: 3, budget_allocated: 200 },
      ],
      'ph1'
    )
    expect(remaining.get(3)).toBe(500)
  })

  it('offers nothing for a classification the TIC does not plan', () => {
    const remaining = remainingFromTIC(totals, [], 'ph1')
    expect(remaining.has(5)).toBe(false)
  })
})

// ---------------------------------------------------------------------- phases
//
// Modelled on 1908_TIC_Osijek.xlsx. Two rows are deliberately unphased: the land is bought once
// and project preparation is not attributable to a phase, so both show their full value against
// every phase in the source sheet. Summing those columns would overstate the project by
// €8.087.207,40 — the exact gap between the sheet's phase subtotals and its own grand total.
const ph = (phase_number: number, vlastita: number, kreditna: number) =>
  ({ phase_number, vlastita, kreditna })

const OSIJEK: LineItem[] = [
  { name: 'Priprema projekta', vlastita: 43603.70, kreditna: 0, classification_id: 2 },
  { name: 'Vrijednost zemljišta', vlastita: 4000000, kreditna: 0, classification_id: 1 },
  { name: 'Projektna dokumentacija, geodetske usluge', vlastita: 708560.13, kreditna: 0, classification_id: 2,
    phases: [ph(1, 333023.26, 0), ph(2, 240910.44, 0), ph(3, 134626.42, 0)] },
  { name: 'Komunalni i vodni doprinos', vlastita: 937136.97, kreditna: 0, classification_id: 2,
    phases: [ph(1, 440454.37, 0), ph(2, 318626.57, 0), ph(3, 178056.02, 0)] },
  { name: 'Priključci', vlastita: 0, kreditna: 364250, classification_id: 2,
    phases: [ph(1, 0, 171197.50), ph(2, 0, 123845), ph(3, 0, 69207.50)] },
  { name: 'Građenje', vlastita: 0, kreditna: 33034773.07, classification_id: 3,
    phases: [ph(1, 0, 13826343.34), ph(2, 0, 12231822.84), ph(3, 0, 6976606.88)] },
  { name: 'Stručni nadzor', vlastita: 0, kreditna: 239820.35, classification_id: 5,
    phases: [ph(1, 0, 112715.56), ph(2, 0, 81538.92), ph(3, 0, 45565.87)] },
  { name: 'Konzalting', vlastita: 283424.05, kreditna: 0, classification_id: 5,
    phases: [ph(1, 133209.30, 0), ph(2, 96364.18, 0), ph(3, 53850.57, 0)] },
  { name: 'Posredovanje, marketing, osiguranje', vlastita: 0, kreditna: 150000, classification_id: 6,
    phases: [ph(1, 0, 0), ph(2, 0, 51000), ph(3, 0, 99000)] },
  { name: 'Financijski nadzor', vlastita: 0, kreditna: 82586.93, classification_id: 6,
    phases: [ph(1, 0, 38815.86), ph(2, 0, 28079.56), ph(3, 0, 15691.52)] },
  { name: 'Financiranje', vlastita: 0, kreditna: 732586.93, classification_id: 6,
    phases: [ph(1, 0, 344315.86), ph(2, 0, 249079.56), ph(3, 0, 139191.52)] },
  { name: 'Uknjižba, etažiranje, uporabna dozvola', vlastita: 43500, kreditna: 0, classification_id: 5,
    phases: [ph(1, 20445, 0), ph(2, 14790, 0), ph(3, 8265, 0)] },
  { name: 'Nepredviđeni troškovi', vlastita: 0, kreditna: 825869.33, classification_id: 7,
    phases: [ph(1, 0, 388158.58), ph(2, 0, 280795.57), ph(3, 0, 156915.17)] },
]

describe('phaseTotals', () => {
  // The source rounds each phase cell to cents, so a phased line's phase columns need not sum
  // to the cent onto its project column — three of the Osijek rows are a cent out. Aggregates
  // are therefore asserted to within a few cents, not exactly. Deliberately NOT normalised:
  // rewriting the user's figures to make them tie would be inventing data.
  const CENTS = 0.05

  it('reproduces the Osijek phase split', () => {
    const { byPhase, notPhased, total } = phaseTotals(OSIJEK)
    expect(byPhase.get(1)).toBeCloseTo(15808678.65, 1)
    expect(byPhase.get(2)).toBeCloseTo(13716852.64, 1)
    expect(byPhase.get(3)).toBeCloseTo(7876976.47, 1)
    // Unphased money passes through untouched, so this one IS exact.
    expect(notPhased).toBe(4043603.70)
    expect(total).toBeCloseTo(41446111.46, 1)
  })

  it('reconciles: phases plus unphased equals the project total, within source rounding', () => {
    // The invariant the whole grid rests on. The sheet's own phase subtotals
    // (19.852.282 / 17.760.456 / 11.920.580) do NOT reconcile at all — they double-count the
    // unphased rows by €8.087.207,40. Separating those is what makes this add up.
    const { byPhase, notPhased, total } = phaseTotals(OSIJEK)
    const summed = [...byPhase.values()].reduce((s, v) => s + v, 0) + notPhased
    expect(Math.abs(summed - total)).toBeLessThan(CENTS)
    // total comes from the project columns only, so this half is exact.
    expect(total).toBeCloseTo(ticGrandTotal(OSIJEK), 6)
  })

  it('counts land once rather than once per phase', () => {
    // Repeating it would add €8.000.000 of imaginary budget.
    const land = OSIJEK.find(i => i.name === 'Vrijednost zemljišta')!
    expect(land.phases).toBeUndefined()
    expect(phaseTotals([land]).notPhased).toBe(4000000)
    expect(phaseTotals([land]).byPhase.size).toBe(0)
  })

  it('treats an unphased TIC as entirely project-level', () => {
    const flat = [{ name: 'a', vlastita: 100, kreditna: 50, classification_id: 1 }]
    const { byPhase, notPhased, total } = phaseTotals(flat)
    expect(byPhase.size).toBe(0)
    expect(notPhased).toBe(150)
    expect(total).toBe(150)
  })

  it('is empty for no line items', () => {
    expect(phaseTotals([])).toEqual({ byPhase: new Map(), notPhased: 0, total: 0 })
  })
})

describe('budgetMatrix', () => {
  const ORDER = [1, 2, 3, 4, 5, 6, 7]
  const CENTS = 0.05

  it('lays out classifications against phases with reconciling edges', () => {
    const m = budgetMatrix(OSIJEK, ORDER)
    expect(m.phaseNumbers).toEqual([1, 2, 3])
    expect(m.grandTotal).toBeCloseTo(41446111.46, 2)

    const columnSum = [...m.columnTotals.values()].reduce((s, v) => s + v, 0)
    expect(Math.abs(columnSum + m.notPhasedTotal - m.grandTotal)).toBeLessThan(CENTS)

    // Rows are built from the project columns, so the row edge ties exactly.
    const rowSum = m.rows.reduce((s, r) => s + r.total, 0)
    expect(rowSum).toBeCloseTo(m.grandTotal, 6)
  })

  it('puts construction where the money actually is', () => {
    const m = budgetMatrix(OSIJEK, ORDER)
    const izgradnja = m.rows.find(r => r.classificationId === 3)!
    expect(izgradnja.byPhase.get(1)).toBeCloseTo(13826343.34, 2)
    expect(izgradnja.total).toBeCloseTo(33034773.07, 2)
    expect(izgradnja.notPhased).toBe(0)
  })

  it('shows land as unphased rather than spread across the row', () => {
    const m = budgetMatrix(OSIJEK, ORDER)
    const zemljiste = m.rows.find(r => r.classificationId === 1)!
    expect(zemljiste.byPhase.size).toBe(0)
    expect(zemljiste.notPhased).toBe(4000000)
    expect(zemljiste.total).toBe(4000000)
  })

  it('orders rows by the given classification order, unmapped last', () => {
    const m = budgetMatrix(
      [
        { name: 'unmapped', vlastita: 10, kreditna: 0 },
        { name: 'c', vlastita: 10, kreditna: 0, classification_id: 3 },
        { name: 'a', vlastita: 10, kreditna: 0, classification_id: 1 },
      ],
      ORDER
    )
    expect(m.rows.map(r => r.classificationId)).toEqual([1, 3, null])
  })

  it('has no phase columns for an unphased TIC', () => {
    const m = budgetMatrix([{ name: 'a', vlastita: 100, kreditna: 0, classification_id: 1 }], ORDER)
    expect(m.phaseNumbers).toEqual([])
    expect(m.notPhasedTotal).toBe(100)
  })
})

describe('phaseClassificationTotals', () => {
  it('gives the per-(phase, classification) amounts the budgets are synced from', () => {
    const byPhase = phaseClassificationTotals(OSIJEK)
    // Faza 1, Priprema i razvoj = doc 333.023,26 + komunalni 440.454,37 + priključci 171.197,50
    expect(byPhase.get(1)!.get(2)).toBeCloseTo(944675.13, 2)
    expect(byPhase.get(1)!.get(3)).toBeCloseTo(13826343.34, 2)
    // Kontrola in phase 1 = nadzor 112.715,56 + konzalting 133.209,30 + uknjižba 20.445
    expect(byPhase.get(1)!.get(5)).toBeCloseTo(266369.86, 2)
  })

  it('excludes unphased and unmapped lines', () => {
    const byPhase = phaseClassificationTotals(OSIJEK)
    // Land is unphased, so it appears in no phase's row at all.
    for (const row of byPhase.values()) expect(row.has(1)).toBe(false)

    const unmapped = phaseClassificationTotals([
      { name: 'x', vlastita: 100, kreditna: 0, phases: [ph(1, 100, 0)] },
    ])
    expect(unmapped.size).toBe(0)
  })

  it('sums to each phase total once unphased money is set aside', () => {
    const byPhase = phaseClassificationTotals(OSIJEK)
    const totals = phaseTotals(OSIJEK)
    for (const [phaseNumber, row] of byPhase) {
      const summed = [...row.values()].reduce((s, v) => s + v, 0)
      expect(Math.abs(summed - totals.byPhase.get(phaseNumber)!)).toBeLessThan(0.05)
    }
  })
})

describe('phaseSplitCheck', () => {
  it('reports a split that matches the row it divides', () => {
    const check = phaseSplitCheck({
      name: 'Građenje', vlastita: 300, kreditna: 700,
      phases: [ph(1, 100, 200), ph(2, 200, 500)],
    })
    expect(check.vlastita).toBe(300)
    expect(check.kreditna).toBe(700)
    expect(check.balanced).toBe(true)
  })

  it('tolerates the cent the source rounds each phase cell to', () => {
    const check = phaseSplitCheck({
      name: 'x', vlastita: 100, kreditna: 0,
      phases: [ph(1, 33.33, 0), ph(2, 33.33, 0), ph(3, 33.33, 0)],
    })
    expect(check.balanced).toBe(true)
  })

  it('signs the difference so the UI can say over or under', () => {
    const over = phaseSplitCheck({ name: 'x', vlastita: 100, kreditna: 0, phases: [ph(1, 150, 0)] })
    expect(over.vlastitaDiff).toBe(50)
    expect(over.balanced).toBe(false)

    const under = phaseSplitCheck({ name: 'x', vlastita: 100, kreditna: 0, phases: [ph(1, 40, 0)] })
    expect(under.vlastitaDiff).toBe(-60)
  })

  it('treats an unphased row as having no split at all, never as a mismatch', () => {
    const item: LineItem = { name: 'Vrijednost zemljišta', vlastita: 4000000, kreditna: 0 }
    expect(phaseSplitCheck(item).vlastita).toBe(0)
    expect(hasPhaseSplitMismatch(item)).toBe(false)
  })

  it('flags a row whose funds were edited after it was split', () => {
    expect(hasPhaseSplitMismatch({
      name: 'x', vlastita: 500, kreditna: 0, phases: [ph(1, 100, 0), ph(2, 100, 0)],
    })).toBe(true)
  })

  it('finds no mismatch anywhere in the Osijek plan', () => {
    expect(OSIJEK.filter(hasPhaseSplitMismatch)).toEqual([])
  })
})

describe('ticPhaseCount', () => {
  it('is the highest ordinal used, so an empty middle phase keeps its column', () => {
    expect(ticPhaseCount([
      { name: 'a', vlastita: 1, kreditna: 0, phases: [ph(1, 1, 0)] },
      { name: 'b', vlastita: 1, kreditna: 0, phases: [ph(3, 1, 0)] },
    ])).toBe(3)
  })

  it('is zero for an unphased TIC', () => {
    expect(ticPhaseCount(MALA_SAVSKA)).toBe(0)
  })

  it('counts the three phases of the Osijek plan', () => {
    expect(ticPhaseCount(OSIJEK)).toBe(3)
  })
})

describe('normalizePhaseNumbers', () => {
  it('leaves a contiguous plan untouched, by identity', () => {
    expect(normalizePhaseNumbers(OSIJEK)).toBe(OSIJEK)
    expect(normalizePhaseNumbers(MALA_SAVSKA)).toBe(MALA_SAVSKA)
  })

  it('closes a gap that would make the sync delete the phase it just created', () => {
    // A sheet with FAZA 1 and FAZA 3 but no FAZA 2: sync_project_from_tic counts 2 phases and
    // deletes every project phase numbered above 2 — including the 3 it had just inserted.
    const gapped: LineItem[] = [
      { name: 'a', vlastita: 100, kreditna: 0, phases: [ph(1, 60, 0), ph(3, 40, 0)] },
      { name: 'b', vlastita: 50, kreditna: 0, phases: [ph(3, 50, 0)] },
    ]
    const fixed = normalizePhaseNumbers(gapped)
    expect(fixed[0].phases!.map(p => p.phase_number)).toEqual([1, 2])
    expect(fixed[1].phases!.map(p => p.phase_number)).toEqual([2])
  })

  it('keeps the amounts and the ordering of the phases it renumbers', () => {
    const fixed = normalizePhaseNumbers([
      { name: 'a', vlastita: 100, kreditna: 25, phases: [ph(2, 100, 25)] },
    ])
    expect(fixed[0].phases).toEqual([{ phase_number: 1, vlastita: 100, kreditna: 25 }])
    expect(fixed[0].vlastita).toBe(100)
  })

  it('leaves unphased rows without a phases key', () => {
    const fixed = normalizePhaseNumbers([
      { name: 'land', vlastita: 400, kreditna: 0 },
      { name: 'a', vlastita: 100, kreditna: 0, phases: [ph(2, 100, 0)] },
    ])
    expect('phases' in fixed[0]).toBe(false)
  })
})
