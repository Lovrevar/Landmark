import { formatEuro } from '../../../../utils/formatters'

/**
 * A month's budget against what was paid out in it.
 *
 * `difference` is budget − paid, so it carries its own sign: positive is money left, negative is
 * an overrun. The summary row is labelled "Razlika od budžeta" in both cases — the label does not
 * say which way — so the figure has to. It used to be printed through `Math.abs`: a €450.000
 * budget with €2.141.590 paid read "€1.691.590 (Preko budžeta - loše)", an overrun shown as a
 * positive amount with only the colour and the suffix to contradict it.
 *
 * (The Accounting dashboard's budget tile also prints an absolute value, but its *label* switches
 * between "remaining" and "overage", so nothing there needs a sign.)
 */
export interface BudgetDifference {
  /** budget − paid, to the cent. Negative when the month is over budget. */
  difference: number
  overBudget: boolean
  /** The signed amount as shown: "€8.409,50" or "−€1.691.590,00". */
  formatted: string
}

export function budgetDifference(budgetAmount: number, paid: number): BudgetDifference {
  // Whole cents, so a month paid exactly to budget is 0 and not a float residue that would be
  // negative and read as an overrun.
  const difference = (Math.round(budgetAmount * 100) - Math.round(paid * 100)) / 100
  return { difference, overBudget: difference < 0, formatted: formatEuro(difference) }
}
