import {
  CostClassification,
  GroupDimension,
  GroupRollup,
  PhaseClassificationBudget,
  SubcontractorWithPhase,
  TreeNode
} from '../types'
import { ProjectPhase } from '../../../../lib/supabase'

/**
 * Grouping and money math for the Site Management contract tree.
 *
 * Pure on purpose: this file carries the logic that used to be inline in PhaseCard, where it
 * could not be tested at all. Both views ("by phase" and "by classification") are the same tree
 * built with the top two dimensions swapped, so correctness here covers both.
 */

// ---------------------------------------------------------------------------- keys

const NONE = 'none'

const segment = (dimension: GroupDimension, id: string | number | null): string => {
  const prefix = dimension === 'phase' ? 'phase' : dimension === 'classification' ? 'cls' : 'type'
  return `${prefix}:${id ?? NONE}`
}

/** Path key for a node. Encodes the dimension order, so the two views never share state. */
export const nodeKey = (path: Array<{ dimension: GroupDimension; id: string | number | null }>): string =>
  path.map(p => segment(p.dimension, p.id)).join('|')

// ------------------------------------------------------------------------- rollups

/**
 * Reproduces the split the phase card has always used: a row counts as "contracted" only when
 * it has a contract AND a non-zero amount. Everything else — including a contract row with a
 * zero amount — is treated as uncontracted, where the amount owed comes from invoices rather
 * than from a contract value.
 */
export function rollupContracts(contracts: SubcontractorWithPhase[]): GroupRollup {
  let contracted = 0
  let paid = 0
  let unpaid = 0
  let unpaidWithoutContract = 0

  for (const sub of contracts) {
    const cost = sub.cost ?? 0
    const isContracted = sub.has_contract !== false && cost > 0
    // `budget_realized` is the app's single figure for money paid on a contract — a trigger-kept
    // cache of sum(accounting_payments.amount), repaired and sealed by migration 20260910120000.
    // Summing the invoices' `paid_amount` gives the same number by construction; this needs no
    // second query. `invoice_total_owed` below has no equivalent, since payments cannot say what
    // is still outstanding.
    const subPaid = sub.budget_realized || 0

    paid += subPaid

    if (isContracted) {
      contracted += cost
      unpaid += Math.max(0, cost - subPaid)
    } else {
      const owed = sub.invoice_total_owed || 0
      unpaid += owed
      unpaidWithoutContract += owed
    }
  }

  return { contracted, paid, unpaid, unpaidWithoutContract, count: contracts.length }
}

/**
 * A contract counts as settled when it has been paid in full — or, for a row with no contract,
 * when something was paid and nothing is still owed.
 *
 * The two branches exist because an uncontracted row has no agreed amount to compare against;
 * all it has is what invoices say was paid and what is still outstanding.
 */
export const isFullySettled = (sub: SubcontractorWithPhase): boolean =>
  sub.has_contract
    ? sub.budget_realized >= sub.cost && sub.cost > 0
    : (sub.invoice_total_owed ?? 0) === 0 && (sub.budget_realized ?? 0) > 0

/** Budget headroom, matching the phase card's "remaining" tile. */
export const remainingBudget = (budget: number, rollup: GroupRollup): number =>
  budget - rollup.contracted - rollup.unpaidWithoutContract

/**
 * Whether a contract of `cost` would overrun what is left of a phase's plan.
 *
 * A phase with no allocated budget has nothing to exceed, and that case is not hypothetical: the
 * TIC is the only writer of planned budget, so every phase of a project without one sits at 0.
 * Reading that as "a budget of zero, which everything overruns" would make it impossible to
 * record a single contract — and would blame the contract amount for a missing cost plan.
 */
export const exceedsPhaseBudget = (
  phase: { budget_allocated: number; budget_used: number },
  cost: number
): boolean => phase.budget_allocated > 0 && cost > phase.budget_allocated - phase.budget_used

// -------------------------------------------------------------------------- context

export interface TreeContext {
  phases: ProjectPhase[]
  classifications: CostClassification[]
  budgets: PhaseClassificationBudget[]
  labels: {
    /** Contracts with no cost classification. */
    unclassified: string
    /** Contracts with no contract type. */
    uncategorizedType: string
    /** Renders a phase node's label, e.g. "Faza 1 · Izgradnja zgrade A". */
    phase: (phase: ProjectPhase) => string
  }
}

interface DimensionValue {
  id: string | number | null
  label: string
  sortKey: number
}

function valueFor(dimension: GroupDimension, sub: SubcontractorWithPhase, ctx: TreeContext): DimensionValue {
  if (dimension === 'phase') {
    const phase = ctx.phases.find(p => p.id === sub.phase_id)
    return {
      id: sub.phase_id ?? null,
      label: phase ? ctx.labels.phase(phase) : (sub.phase_name ?? ''),
      sortKey: phase?.phase_number ?? Number.MAX_SAFE_INTEGER
    }
  }
  if (dimension === 'classification') {
    const id = sub.classification_id ?? null
    return {
      id,
      label: sub.classification_name ?? ctx.labels.unclassified,
      // Unclassified sorts last, matching how uncategorised contract types already behave.
      sortKey: id === null ? Number.MAX_SAFE_INTEGER : (sub.classification_sort_order ?? 0)
    }
  }
  const typeId = sub.contract_type_id ?? null
  return {
    id: typeId,
    label: sub.contract_type_name ?? ctx.labels.uncategorizedType,
    // Types have no ordering column, so they sort by label — except the uncategorised bucket,
    // which is pinned last exactly as the phase card has always shown it.
    sortKey: typeId === null ? Number.MAX_SAFE_INTEGER : 0
  }
}

/**
 * Budget attached to a node, given the full path from the root.
 *
 * The (phase x classification) pair is what actually carries a sub-allocation, so it resolves
 * the same amount in both views — whichever of the two is the outer level. A phase on its own
 * carries its stored budget; a classification on its own is a derived sum across the phases in
 * scope and is not editable there.
 */
function budgetFor(
  path: Array<{ dimension: GroupDimension; id: string | number | null }>,
  ctx: TreeContext,
  phaseIdsInScope: string[]
): number | null {
  const phaseId = path.find(p => p.dimension === 'phase')?.id as string | undefined
  const classificationId = path.find(p => p.dimension === 'classification')?.id as number | null | undefined
  const last = path[path.length - 1]

  if (last.dimension === 'contractType') return null

  if (phaseId != null && classificationId != null) {
    const row = ctx.budgets.find(b => b.phase_id === phaseId && b.classification_id === classificationId)
    return row?.budget_allocated ?? 0
  }

  if (last.dimension === 'phase' && phaseId != null) {
    return ctx.phases.find(p => p.id === phaseId)?.budget_allocated ?? 0
  }

  if (last.dimension === 'classification') {
    if (classificationId == null) return null // unclassified bucket has no budget
    return ctx.budgets
      .filter(b => b.classification_id === classificationId && phaseIdsInScope.includes(b.phase_id))
      .reduce((sum, b) => sum + b.budget_allocated, 0)
  }

  return null
}

// ----------------------------------------------------------------------- the tree

function build(
  contracts: SubcontractorWithPhase[],
  dimensions: GroupDimension[],
  ctx: TreeContext,
  parentPath: Array<{ dimension: GroupDimension; id: string | number | null }>,
  phaseIdsInScope: string[],
  pinned: Array<{ dimension: GroupDimension; id: string | number | null; label: string; sortKey: number }>
): TreeNode[] {
  if (dimensions.length === 0) return []

  const [dimension, ...rest] = dimensions
  const groups = new Map<string, { value: DimensionValue; items: SubcontractorWithPhase[] }>()

  for (const sub of contracts) {
    const value = valueFor(dimension, sub, ctx)
    const key = segment(dimension, value.id)
    const existing = groups.get(key)
    if (existing) existing.items.push(sub)
    else groups.set(key, { value, items: [sub] })
  }

  // A classification that is budgeted but has no contracts yet must still appear — that is how
  // a phase is planned before any work is contracted.
  for (const extra of pinned) {
    if (extra.dimension !== dimension) continue
    const key = segment(dimension, extra.id)
    if (!groups.has(key)) {
      groups.set(key, { value: { id: extra.id, label: extra.label, sortKey: extra.sortKey }, items: [] })
    }
  }

  return Array.from(groups.values())
    .map(({ value, items }) => {
      const path = [...parentPath, { dimension, id: value.id }]
      const scope = dimension === 'phase' && typeof value.id === 'string' ? [value.id] : phaseIdsInScope
      const children = build(items, rest, ctx, path, scope, pinned)
      return {
        key: nodeKey(path),
        dimension,
        id: value.id,
        label: value.label,
        sortKey: value.sortKey,
        budget: budgetFor(path, ctx, scope),
        rollup: rollupContracts(items),
        children,
        contracts: rest.length === 0 ? items : []
      }
    })
    .sort((a, b) => (a.sortKey - b.sortKey) || a.label.localeCompare(b.label))
}

/**
 * Build the contract tree for one project.
 *
 * `dimensions` comes from VIEW_DIMENSIONS and is the only difference between the two views.
 */
export function buildContractTree(
  contracts: SubcontractorWithPhase[],
  dimensions: GroupDimension[],
  ctx: TreeContext
): TreeNode[] {
  const phaseIds = ctx.phases.map(p => p.id)

  // Budgeted-but-empty groups, so planning shows up before any contract exists.
  const pinned = ctx.budgets
    .filter(b => phaseIds.includes(b.phase_id))
    .map(b => {
      const classification = ctx.classifications.find(c => c.id === b.classification_id)
      return {
        dimension: 'classification' as GroupDimension,
        id: b.classification_id as string | number | null,
        label: classification?.name ?? '',
        sortKey: classification?.sort_order ?? 0
      }
    })
    .filter(p => p.label !== '')

  const pinnedPhases = ctx.phases.map(p => ({
    dimension: 'phase' as GroupDimension,
    id: p.id as string | number | null,
    label: ctx.labels.phase(p),
    sortKey: p.phase_number
  }))

  return build(contracts, dimensions, ctx, [], phaseIds, [...pinned, ...pinnedPhases])
}

/**
 * Phase budget not yet handed to any classification. Shown as "Neraspoređeno" so the phase-first
 * and classification-first views visibly reconcile: they otherwise differ by exactly this amount.
 */
export function unallocatedBudget(phase: ProjectPhase, budgets: PhaseClassificationBudget[]): number {
  const allocated = budgets
    .filter(b => b.phase_id === phase.id)
    .reduce((sum, b) => sum + b.budget_allocated, 0)
  return phase.budget_allocated - allocated
}
