import { LineItem, calculateTotals } from './ticFormatters'

/**
 * Turning a TIC into planned budget figures.
 *
 * The TIC is the investment cost plan; these functions are how it reaches
 * `projects.budget` and `phase_classification_budgets`. Pure, so the TIC screen and Site
 * Management compute identical numbers from one implementation rather than two.
 *
 * Only the INVESTICIJA rows (`line_items`) feed budgets. The GRAĐENJE tab
 * (`construction_sections`) is a breakdown of the single "Građenje" line — in the source
 * workbook its SVEUKUPNO equals that line exactly — so counting both would double the largest
 * item in the plan. Nothing here takes construction sections, and nothing should.
 */

export interface ClassificationTotals {
  /** Planned amount per classification id. Only classifications with money appear. */
  byClassification: Map<number, number>
  /** Money on rows with no classification yet. Shown as "Neraspoređeno u TIC-u", never dropped. */
  unmapped: number
  /** Every row summed, mapped or not. Equals `ticGrandTotal`. */
  total: number
}

/** A line's planned amount: own funds plus credit. The split matters to investors, not to budgets. */
export const lineItemTotal = (item: LineItem): number => item.vlastita + item.kreditna

/** The TIC grand total — the "UKUPNO:" figure, and what a project's budget syncs to. */
export const ticGrandTotal = (lineItems: LineItem[]): number => {
  const { vlastita, kreditna } = calculateTotals(lineItems)
  return vlastita + kreditna
}

/**
 * Group the investment lines by cost classification.
 *
 * Rows whose `classification_id` is null or undefined are summed into `unmapped` rather than
 * assigned a bucket, so `byClassification` never contains money the user did not place. The
 * invariant `sum(byClassification) + unmapped === total` holds for any input.
 */
export function totalsByClassification(lineItems: LineItem[]): ClassificationTotals {
  const byClassification = new Map<number, number>()
  let unmapped = 0
  let total = 0

  for (const item of lineItems) {
    const amount = lineItemTotal(item)
    total += amount

    const id = item.classification_id
    if (id === null || id === undefined) {
      unmapped += amount
      continue
    }

    byClassification.set(id, (byClassification.get(id) ?? 0) + amount)
  }

  return { byClassification, unmapped, total }
}

/**
 * What a phase should receive per classification when populating from the TIC: the plan minus
 * whatever other phases have already taken.
 *
 * `existingByPhase` is every `phase_classification_budgets` row for the project. The phase being
 * filled is excluded from the "already taken" sum so re-running the fill is idempotent rather
 * than compounding — press the button twice and you get the same numbers, not half of them.
 *
 * Clamped at zero: if other phases have over-committed a classification there is nothing left to
 * give, and a negative budget is not a meaningful thing to write.
 */
export function remainingFromTIC(
  totals: ClassificationTotals,
  existingByPhase: Array<{ phase_id: string; classification_id: number; budget_allocated: number }>,
  targetPhaseId: string
): Map<number, number> {
  const takenElsewhere = new Map<number, number>()
  for (const row of existingByPhase) {
    if (row.phase_id === targetPhaseId) continue
    takenElsewhere.set(
      row.classification_id,
      (takenElsewhere.get(row.classification_id) ?? 0) + row.budget_allocated
    )
  }

  const remaining = new Map<number, number>()
  for (const [classificationId, planned] of totals.byClassification) {
    remaining.set(classificationId, Math.max(0, planned - (takenElsewhere.get(classificationId) ?? 0)))
  }
  return remaining
}

// --------------------------------------------------------------------- phases

/** A line counts toward a phase only when it carries a split; otherwise it is project-level. */
export const isPhased = (item: LineItem): boolean => !!item.phases && item.phases.length > 0

export interface PhaseTotals {
  /** Planned amount per phase_number. Only phases the TIC actually mentions appear. */
  byPhase: Map<number, number>
  /**
   * Costs that belong to the project but to no single phase — land, project preparation.
   * Counted once here rather than repeated into every phase.
   */
  notPhased: number
  /** Every line summed. Equals `ticGrandTotal`, so byPhase + notPhased reconciles to it. */
  total: number
}

/**
 * Split the plan by phase.
 *
 * The invariant `sum(byPhase) + notPhased === total` holds for any input, which is what lets
 * the UI show a grid that visibly adds up to the project budget.
 */
export function phaseTotals(lineItems: LineItem[]): PhaseTotals {
  const byPhase = new Map<number, number>()
  let notPhased = 0
  let total = 0

  for (const item of lineItems) {
    const amount = lineItemTotal(item)
    total += amount

    if (!isPhased(item)) {
      notPhased += amount
      continue
    }

    for (const phase of item.phases!) {
      const phaseAmount = phase.vlastita + phase.kreditna
      byPhase.set(phase.phase_number, (byPhase.get(phase.phase_number) ?? 0) + phaseAmount)
    }
  }

  return { byPhase, notPhased, total }
}

/** Amount a single line puts into one phase. Zero when the line is not phased. */
export const lineItemPhaseTotal = (item: LineItem, phaseNumber: number): number => {
  const phase = item.phases?.find(p => p.phase_number === phaseNumber)
  return phase ? phase.vlastita + phase.kreditna : 0
}

export interface BudgetMatrixRow {
  classificationId: number | null
  /** Amount per phase_number, then the row total across every phase AND unphased money. */
  byPhase: Map<number, number>
  notPhased: number
  total: number
}

export interface BudgetMatrix {
  /** Phase numbers present in the plan, ascending. Empty for an unphased TIC. */
  phaseNumbers: number[]
  /** One row per classification that has money, plus a null row for unmapped lines. */
  rows: BudgetMatrixRow[]
  columnTotals: Map<number, number>
  notPhasedTotal: number
  grandTotal: number
}

/**
 * The classification × phase grid, laid out the way the TIC spreadsheet itself is.
 *
 * Rows are ordered by the caller's classification order (sort_order), with unmapped money last
 * so it reads as a remainder rather than a category.
 */
export function budgetMatrix(
  lineItems: LineItem[],
  classificationOrder: number[]
): BudgetMatrix {
  const phaseNumbers = [...new Set(
    lineItems.flatMap(i => i.phases?.map(p => p.phase_number) ?? [])
  )].sort((a, b) => a - b)

  const rowsById = new Map<number | null, BudgetMatrixRow>()
  const columnTotals = new Map<number, number>()
  let notPhasedTotal = 0
  let grandTotal = 0

  for (const item of lineItems) {
    const key = item.classification_id ?? null
    let row = rowsById.get(key)
    if (!row) {
      row = { classificationId: key, byPhase: new Map(), notPhased: 0, total: 0 }
      rowsById.set(key, row)
    }

    const amount = lineItemTotal(item)
    row.total += amount
    grandTotal += amount

    if (!isPhased(item)) {
      row.notPhased += amount
      notPhasedTotal += amount
      continue
    }

    for (const phase of item.phases!) {
      const phaseAmount = phase.vlastita + phase.kreditna
      row.byPhase.set(phase.phase_number, (row.byPhase.get(phase.phase_number) ?? 0) + phaseAmount)
      columnTotals.set(phase.phase_number, (columnTotals.get(phase.phase_number) ?? 0) + phaseAmount)
    }
  }

  const rank = new Map(classificationOrder.map((id, i) => [id, i]))
  const rows = [...rowsById.values()].sort((a, b) => {
    // Unmapped last: it is a gap in the plan, not one of its categories.
    if (a.classificationId === null) return 1
    if (b.classificationId === null) return -1
    return (rank.get(a.classificationId) ?? Number.MAX_SAFE_INTEGER)
         - (rank.get(b.classificationId) ?? Number.MAX_SAFE_INTEGER)
  })

  return { phaseNumbers, rows, columnTotals, notPhasedTotal, grandTotal }
}

/**
 * Planned budget for one (phase, classification) pair — what phase_classification_budgets is
 * synced from.
 */
export function phaseClassificationTotals(
  lineItems: LineItem[]
): Map<number, Map<number, number>> {
  const byPhase = new Map<number, Map<number, number>>()

  for (const item of lineItems) {
    const classificationId = item.classification_id
    if (classificationId === null || classificationId === undefined) continue
    if (!isPhased(item)) continue

    for (const phase of item.phases!) {
      let row = byPhase.get(phase.phase_number)
      if (!row) { row = new Map(); byPhase.set(phase.phase_number, row) }
      const amount = phase.vlastita + phase.kreditna
      row.set(classificationId, (row.get(classificationId) ?? 0) + amount)
    }
  }

  return byPhase
}
