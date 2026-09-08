import { describe, it, expect } from 'vitest'
import {
  buildContractTree,
  rollupContracts,
  isFullySettled,
  remainingBudget,
  exceedsPhaseBudget,
  unallocatedBudget,
  nodeKey,
  TreeContext
} from './contractTree'
import { SubcontractorWithPhase, VIEW_DIMENSIONS, TreeNode } from '../types'
import { formatPhaseLabel } from '../../../../utils/phaseLabel'
import { ProjectPhase, CostClassification, PhaseClassificationBudget } from '../../../../lib/supabase'

const phase = (id: string, number: number, name: string, budget = 0): ProjectPhase => ({
  id, project_id: 'p1', phase_number: number, phase_name: name,
  budget_allocated: budget, budget_used: 0, start_date: null, end_date: null,
  status: 'planning', created_at: ''
})

const classification = (id: number, name: string, sort: number): CostClassification => ({
  id, code: null, name, description: null, sort_order: sort, is_system: true, is_active: true
})

const budget = (phaseId: string, classificationId: number, amount: number): PhaseClassificationBudget => ({
  id: `b-${phaseId}-${classificationId}`, phase_id: phaseId,
  classification_id: classificationId, budget_allocated: amount, notes: null
})

const contract = (over: Partial<SubcontractorWithPhase> = {}): SubcontractorWithPhase => ({
  id: 'c1', name: 'Izvođač', contact: '', created_at: '',
  cost: 1000, budget_realized: 0,
  phase_id: 'ph1', has_contract: true,
  invoice_total_paid: 0, invoice_total_owed: 0,
  contract_type_id: 3, contract_type_name: 'Razno',
  classification_id: 20, classification_name: 'Priprema i razvoj', classification_sort_order: 20,
  ...over
} as SubcontractorWithPhase)

const ZEMLJISTE = classification(10, 'Zemljište', 10)
const PRIPREMA = classification(20, 'Priprema i razvoj', 20)
const OPREMANJE = classification(40, 'Opremanje', 40)

const ctx = (over: Partial<TreeContext> = {}): TreeContext => ({
  phases: [phase('ph1', 1, 'Faza 1', 900_000)],
  classifications: [ZEMLJISTE, PRIPREMA, OPREMANJE],
  budgets: [],
  labels: {
    unclassified: 'Bez klasifikacije',
    uncategorizedType: 'Nekategorizirano',
    phase: p => formatPhaseLabel(p, 'Faza')
  },
  ...over
})

/** Walks the tree collecting every contract, so both views can be compared leaf-for-leaf. */
const leafContracts = (nodes: TreeNode[]): string[] =>
  nodes.flatMap(n => (n.children.length ? leafContracts(n.children) : n.contracts.map(c => c.id))).sort()

describe('rollupContracts', () => {
  it('sums contracted rows and the shortfall still owed on them', () => {
    const r = rollupContracts([
      contract({ id: 'a', cost: 1000, invoice_total_paid: 400 }),
      contract({ id: 'b', cost: 500, invoice_total_paid: 0 })
    ])
    expect(r).toEqual({ contracted: 1500, paid: 400, unpaid: 1100, unpaidWithoutContract: 0, count: 2 })
  })

  it('never reports negative unpaid when a row is overpaid', () => {
    const r = rollupContracts([contract({ cost: 1000, invoice_total_paid: 1800 })])
    expect(r.unpaid).toBe(0)
    expect(r.paid).toBe(1800)
  })

  it('takes the amount owed from invoices for rows with no contract', () => {
    const r = rollupContracts([
      contract({ has_contract: false, cost: 0, invoice_total_paid: 100, invoice_total_owed: 250 })
    ])
    expect(r).toEqual({ contracted: 0, paid: 100, unpaid: 250, unpaidWithoutContract: 250, count: 1 })
  })

  // Pins the pre-existing behaviour of PhaseCard: a zero-cost row counts as uncontracted even
  // when has_contract is true. Refactoring must not quietly change this.
  it('treats a zero-amount row as uncontracted even when has_contract is true', () => {
    const r = rollupContracts([
      contract({ has_contract: true, cost: 0, invoice_total_owed: 700 })
    ])
    expect(r.contracted).toBe(0)
    expect(r.unpaidWithoutContract).toBe(700)
  })

  it('mixes contracted and uncontracted rows without double counting', () => {
    const r = rollupContracts([
      contract({ id: 'a', cost: 1000, invoice_total_paid: 250 }),
      contract({ id: 'b', has_contract: false, cost: 0, invoice_total_paid: 50, invoice_total_owed: 300 })
    ])
    expect(r).toEqual({ contracted: 1000, paid: 300, unpaid: 1050, unpaidWithoutContract: 300, count: 2 })
  })

  it('is empty for no contracts', () => {
    expect(rollupContracts([])).toEqual({
      contracted: 0, paid: 0, unpaid: 0, unpaidWithoutContract: 0, count: 0
    })
  })
})

describe('remainingBudget', () => {
  it('subtracts contracted value and uncontracted debt from the budget', () => {
    const r = rollupContracts([
      contract({ id: 'a', cost: 1000 }),
      contract({ id: 'b', has_contract: false, cost: 0, invoice_total_owed: 200 })
    ])
    expect(remainingBudget(5000, r)).toBe(3800)
  })

  it('goes negative when over budget, rather than clamping', () => {
    expect(remainingBudget(500, rollupContracts([contract({ cost: 900 })]))).toBe(-400)
  })
})

describe('buildContractTree — grouping', () => {
  it('nests phase → classification → contract type', () => {
    const tree = buildContractTree([contract()], VIEW_DIMENSIONS.byPhase, ctx())
    expect(tree).toHaveLength(1)
    expect(tree[0].dimension).toBe('phase')
    expect(tree[0].children[0].dimension).toBe('classification')
    expect(tree[0].children[0].children[0].dimension).toBe('contractType')
    expect(tree[0].children[0].children[0].contracts).toHaveLength(1)
  })

  it('nests classification → phase → contract type in the other view', () => {
    const tree = buildContractTree([contract()], VIEW_DIMENSIONS.byClassification, ctx())
    expect(tree[0].dimension).toBe('classification')
    expect(tree[0].children[0].dimension).toBe('phase')
    expect(tree[0].children[0].children[0].dimension).toBe('contractType')
  })

  it('orders classifications by sort_order, not alphabetically', () => {
    const contracts = [
      contract({ id: 'a', classification_id: 40, classification_name: 'Opremanje', classification_sort_order: 40 }),
      contract({ id: 'b', classification_id: 10, classification_name: 'Zemljište', classification_sort_order: 10 })
    ]
    const tree = buildContractTree(contracts, VIEW_DIMENSIONS.byClassification, ctx())
    expect(tree.map(n => n.label)).toEqual(['Zemljište', 'Opremanje'])
  })

  it('pins the unclassified bucket last', () => {
    const contracts = [
      contract({ id: 'a', classification_id: null, classification_name: null, classification_sort_order: null }),
      contract({ id: 'b', classification_id: 10, classification_name: 'Zemljište', classification_sort_order: 10 })
    ]
    const tree = buildContractTree(contracts, VIEW_DIMENSIONS.byClassification, ctx())
    expect(tree.map(n => n.label)).toEqual(['Zemljište', 'Bez klasifikacije'])
  })

  it('pins the uncategorised contract type last within a classification', () => {
    const contracts = [
      contract({ id: 'a', contract_type_id: null, contract_type_name: null }),
      contract({ id: 'b', contract_type_id: 4, contract_type_name: 'Rušenje' })
    ]
    const tree = buildContractTree(contracts, VIEW_DIMENSIONS.byPhase, ctx())
    const types = tree[0].children[0].children.map(n => n.label)
    expect(types).toEqual(['Rušenje', 'Nekategorizirano'])
  })

  it('shows a budgeted classification that has no contracts yet', () => {
    const tree = buildContractTree(
      [],
      VIEW_DIMENSIONS.byPhase,
      ctx({ budgets: [budget('ph1', 40, 812_401)] })
    )
    const opremanje = tree[0].children.find(n => n.id === 40)
    expect(opremanje).toBeDefined()
    expect(opremanje!.budget).toBe(812_401)
    expect(opremanje!.rollup.count).toBe(0)

    // TreeGroup decides whether a row is expandable from exactly these two being empty, and
    // renders it as a non-interactive row when they are. Pinned here because a change that gave
    // such a node an empty child group would silently make the row clickable again, opening
    // onto nothing.
    expect(opremanje!.children).toEqual([])
    expect(opremanje!.contracts).toEqual([])
  })

  it('shows a phase that has no contracts yet', () => {
    const tree = buildContractTree([], VIEW_DIMENSIONS.byPhase, ctx())
    expect(tree).toHaveLength(1)
    expect(tree[0].rollup.count).toBe(0)
  })
})

describe('buildContractTree — the two views agree', () => {
  const contracts = [
    contract({ id: 'a', phase_id: 'ph1', classification_id: 10, classification_name: 'Zemljište', classification_sort_order: 10, cost: 400 }),
    contract({ id: 'b', phase_id: 'ph1', classification_id: 20, cost: 600 }),
    contract({ id: 'c', phase_id: 'ph2', classification_id: 10, classification_name: 'Zemljište', classification_sort_order: 10, cost: 250 }),
    contract({ id: 'd', phase_id: 'ph2', classification_id: null, classification_name: null, classification_sort_order: null, cost: 125 })
  ]
  const context = ctx({
    phases: [phase('ph1', 1, 'Faza 1', 1000), phase('ph2', 2, 'Faza 2', 500)],
    budgets: [budget('ph1', 10, 400), budget('ph1', 20, 600), budget('ph2', 10, 250)]
  })

  it('contains exactly the same contracts either way round', () => {
    const byPhase = buildContractTree(contracts, VIEW_DIMENSIONS.byPhase, context)
    const byClassification = buildContractTree(contracts, VIEW_DIMENSIONS.byClassification, context)
    expect(leafContracts(byPhase)).toEqual(['a', 'b', 'c', 'd'])
    expect(leafContracts(byClassification)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reports the same grand totals either way round', () => {
    const total = (nodes: TreeNode[]) => nodes.reduce((s, n) => s + n.rollup.contracted, 0)
    expect(total(buildContractTree(contracts, VIEW_DIMENSIONS.byPhase, context)))
      .toBe(total(buildContractTree(contracts, VIEW_DIMENSIONS.byClassification, context)))
  })

  it('resolves the same sub-budget for a (phase, classification) pair in both views', () => {
    const byPhase = buildContractTree(contracts, VIEW_DIMENSIONS.byPhase, context)
    const byClassification = buildContractTree(contracts, VIEW_DIMENSIONS.byClassification, context)

    const fromPhaseView = byPhase.find(n => n.id === 'ph1')!.children.find(n => n.id === 10)!
    const fromClassView = byClassification.find(n => n.id === 10)!.children.find(n => n.id === 'ph1')!

    expect(fromPhaseView.budget).toBe(400)
    expect(fromClassView.budget).toBe(400)
  })

  it('sums a classification across phases at the top of the classification view', () => {
    const tree = buildContractTree(contracts, VIEW_DIMENSIONS.byClassification, context)
    // Zemljište is budgeted 400 on Faza 1 and 250 on Faza 2.
    expect(tree.find(n => n.id === 10)!.budget).toBe(650)
  })

  it('gives the unclassified bucket no budget', () => {
    const tree = buildContractTree(contracts, VIEW_DIMENSIONS.byClassification, context)
    expect(tree.find(n => n.id === null)!.budget).toBeNull()
  })

  it('reports a phase budget from the stored column in the phase view', () => {
    const tree = buildContractTree(contracts, VIEW_DIMENSIONS.byPhase, context)
    expect(tree.find(n => n.id === 'ph1')!.budget).toBe(1000)
  })
})

describe('node keys', () => {
  it('keeps the two views on separate keys for the same contract', () => {
    const byPhase = buildContractTree([contract()], VIEW_DIMENSIONS.byPhase, ctx())
    const byClassification = buildContractTree([contract()], VIEW_DIMENSIONS.byClassification, ctx())
    expect(byPhase[0].key).not.toBe(byClassification[0].key)
  })

  it('distinguishes a null id from a real one', () => {
    expect(nodeKey([{ dimension: 'classification', id: null }])).toBe('cls:none')
    expect(nodeKey([{ dimension: 'classification', id: 12 }])).toBe('cls:12')
  })

  it('does not collide a null id with a classification literally named "none"', () => {
    const a = nodeKey([{ dimension: 'phase', id: 'none' }])
    const b = nodeKey([{ dimension: 'classification', id: null }])
    expect(a).not.toBe(b)
  })

  it('builds a full path key from root to leaf', () => {
    const tree = buildContractTree([contract()], VIEW_DIMENSIONS.byPhase, ctx())
    expect(tree[0].children[0].children[0].key).toBe('phase:ph1|cls:20|type:3')
  })
})

describe('unallocatedBudget', () => {
  it('is the phase budget minus everything handed to classifications', () => {
    const p = phase('ph1', 1, 'Faza 1', 900_000)
    expect(unallocatedBudget(p, [budget('ph1', 10, 400_000), budget('ph1', 20, 300_000)])).toBe(200_000)
  })

  it('is the whole budget when nothing is allocated', () => {
    expect(unallocatedBudget(phase('ph1', 1, 'Faza 1', 900_000), [])).toBe(900_000)
  })

  it('ignores rows belonging to another phase', () => {
    const p = phase('ph1', 1, 'Faza 1', 1000)
    expect(unallocatedBudget(p, [budget('ph2', 10, 999)])).toBe(1000)
  })

  it('goes negative if sub-allocations exceed the phase budget', () => {
    expect(unallocatedBudget(phase('ph1', 1, 'Faza 1', 100), [budget('ph1', 10, 250)])).toBe(-150)
  })
})

describe('isFullySettled', () => {
  it('counts a contract paid up to its value', () => {
    expect(isFullySettled(contract({ has_contract: true, cost: 1000, budget_realized: 1000 }))).toBe(true)
    expect(isFullySettled(contract({ has_contract: true, cost: 1000, budget_realized: 1200 }))).toBe(true)
  })

  it('does not count one still short', () => {
    expect(isFullySettled(contract({ has_contract: true, cost: 1000, budget_realized: 999 }))).toBe(false)
  })

  it('does not count a zero-value contract as settled', () => {
    // Nothing was agreed, so there is nothing to have finished paying.
    expect(isFullySettled(contract({ has_contract: true, cost: 0, budget_realized: 0 }))).toBe(false)
  })

  it('settles an uncontracted row on invoices instead', () => {
    // No agreed amount to compare against, so it goes on what was paid and what is still owed.
    expect(isFullySettled(contract({
      has_contract: false, cost: 0, invoice_total_paid: 500, invoice_total_owed: 0
    }))).toBe(true)
    expect(isFullySettled(contract({
      has_contract: false, cost: 0, invoice_total_paid: 500, invoice_total_owed: 100
    }))).toBe(false)
  })

  it('does not count an untouched uncontracted row', () => {
    expect(isFullySettled(contract({
      has_contract: false, cost: 0, invoice_total_paid: 0, invoice_total_owed: 0
    }))).toBe(false)
  })
})

describe('exceedsPhaseBudget', () => {
  it('blocks a contract that overruns the remaining plan', () => {
    expect(exceedsPhaseBudget({ budget_allocated: 1000, budget_used: 400 }, 601)).toBe(true)
  })

  it('allows a contract that exactly consumes the remainder', () => {
    expect(exceedsPhaseBudget({ budget_allocated: 1000, budget_used: 400 }, 600)).toBe(false)
  })

  it('allows any contract on a phase with no plan', () => {
    // The case that matters: without a TIC every phase sits at 0, and treating that as a
    // budget of zero would block every contract on the project.
    expect(exceedsPhaseBudget({ budget_allocated: 0, budget_used: 0 }, 1_000_000)).toBe(false)
  })

  it('still blocks once a plan exists, even if it is fully consumed', () => {
    expect(exceedsPhaseBudget({ budget_allocated: 1000, budget_used: 1000 }, 1)).toBe(true)
  })
})
