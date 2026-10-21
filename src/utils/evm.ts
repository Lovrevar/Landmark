import type { Phase, ContractWithDetails } from '../components/General/Projects/types'
import { budgetNotSplitByPhase } from '../components/Funding/TIC/utils/ticBudget'

export interface EVMMetrics {
  PV: number
  EV: number
  AC: number
  CPI: number
  SPI: number
  EAC: number
  VAC: number
  CV: number
  SV: number
  /**
   * Whether any phase had both a start and an end date, i.e. whether PV/SPI mean anything.
   * False means SPI fell back to 1 for lack of a baseline, not that the project is on schedule.
   * Set only by calculateProjectEVM; per-phase results always have a schedule by construction.
   */
  scheduleAvailable?: boolean
  /**
   * False until something is paid on a contract whose progress its milestones measure. CPI is
   * otherwise 1 and EAC the budget by construction, not by measurement, so callers must not present
   * them as "under budget". Why it is false is in `costUnavailableReason`.
   */
  costAvailable?: boolean
  /**
   * Set when `costAvailable` is false (GEN-23):
   * - `nothing_paid` — no payment at all;
   * - `no_contract` — everything paid went to suppliers without a contract, which count as earned
   *   for what was paid;
   * - `no_milestones` — the paid contracts have no milestones, so their progress is paid/amount and
   *   earned equals paid.
   */
  costUnavailableReason?: 'nothing_paid' | 'no_contract' | 'no_milestones'
}

export interface MilestoneProgress {
  contract_id: string
  percentage: number
  status: 'pending' | 'completed' | 'paid'
}

// Physical % complete of a single contract, derived from the share of its
// milestones whose work is done (completed or paid). This is independent of
// money spent, which is what makes CPI/SPI meaningful. Falls back to the
// financial proxy (realized / committed) when a contract has no milestones.
function contractPhysicalPct(
  contractId: string,
  contractAmount: number,
  budgetRealized: number,
  milestonesByContract: Map<string, MilestoneProgress[]>
): number {
  const milestones = milestonesByContract.get(contractId)
  if (milestones && milestones.length > 0) {
    const done = milestones
      .filter(m => m.status === 'completed' || m.status === 'paid')
      .reduce((sum, m) => sum + Number(m.percentage || 0), 0)
    return Math.min(100, Math.max(0, done))
  }
  return contractAmount > 0 ? Math.min(100, (budgetRealized / contractAmount) * 100) : 0
}

/**
 * Top of the CPI/SPI chart's axis: 2, or the largest index rounded up to the next 0.5. A fixed
 * [0, 2] let Recharts stretch the axis to the raw value and print it as the top tick (GEN-7).
 */
export function indexAxisTop(largest: number): number {
  return Number.isFinite(largest) ? Math.max(2, Math.ceil(largest * 2) / 2) : 2
}

export function calculatePhaseEVM(
  plannedBudget: number,
  physicalCompletionPct: number,
  plannedStartDate: Date | string,
  plannedEndDate: Date | string,
  actualCost: number,
  currentDate: Date = new Date()
): EVMMetrics {
  const startDate = new Date(plannedStartDate)
  const endDate = new Date(plannedEndDate)

  const totalDuration = endDate.getTime() - startDate.getTime()
  const elapsed = currentDate.getTime() - startDate.getTime()
  const plannedCompletionPct = totalDuration > 0
    ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
    : 0
  const PV = (plannedBudget * plannedCompletionPct) / 100
  const EV = (plannedBudget * physicalCompletionPct) / 100
  const AC = actualCost
  const CPI = AC > 0 ? EV / AC : 1
  const SPI = PV > 0 ? EV / PV : 1
  const CV = EV - AC
  const SV = EV - PV
  const EAC = CPI !== 0 ? plannedBudget / CPI : plannedBudget
  const VAC = plannedBudget - EAC

  return { PV, EV, AC, CPI, SPI, EAC, VAC, CV, SV }
}

/**
 * `projectBudget` is the TIC total. It is read only when the TIC is not split by phase, since the
 * phases then carry no budget of their own (`budgetNotSplitByPhase`).
 */
export function calculateProjectEVM(
  phases: Phase[],
  contracts: ContractWithDetails[],
  milestones: MilestoneProgress[] = [],
  currentDate: Date = new Date(),
  projectBudget: number | null = null
): EVMMetrics {
  let totalPV = 0, totalEV = 0, totalAC = 0, totalBudget = 0
  let contractedAC = 0, measuredAC = 0
  let scheduledPhases = 0

  const milestonesByContract = new Map<string, MilestoneProgress[]>()
  milestones.forEach(m => {
    const list = milestonesByContract.get(m.contract_id)
    if (list) list.push(m)
    else milestonesByContract.set(m.contract_id, [m])
  })

  // An unphased TIC over several phases gives none of them a budget: they carry NULL
  // (apply_unphased_tic_budget). It used to put the whole plan on phase 1, and taken phase by
  // phase that counted the whole budget as earned the day phase 1 was finished — a CPI far above
  // 1 and a forecast equal to paid-to-date (GEN-22). The plan does not distinguish the phases, so
  // neither does the measurement: the project is one phase running from the first start date to
  // the last end date, holding every phase's contracts, measured against the TIC total.
  const phaseIds = new Set(phases.map(phase => phase.id))
  const unphasedPlan = budgetNotSplitByPhase(phases)

  // The span is known only when every phase is dated: taking it from the dated ones alone had the
  // whole plan due by the end of phase 1 whenever the later phases had no dates yet (GEN-23).
  const allDated = phases.every(phase => !!phase.start_date && !!phase.end_date)
  const starts = phases.map(phase => phase.start_date).filter((date): date is string => !!date).sort()
  const ends = phases.map(phase => phase.end_date).filter((date): date is string => !!date).sort()
  const measured = unphasedPlan
    ? [{
        budget: projectBudget ?? 0,
        contracts: contracts.filter(c => c.phase_id != null && phaseIds.has(c.phase_id)),
        start: allDated ? starts[0] ?? null : null,
        end: allDated ? ends[ends.length - 1] ?? null : null,
      }]
    : phases.map(phase => ({
        budget: Number(phase.budget_allocated ?? 0),
        // Join on phase_id, not phase_name. Names are not unique — every project now has a phase
        // called "Faza 1" — so a name-keyed filter silently pulled in other projects' contracts
        // and, within a project, could not tell two same-named phases apart.
        contracts: contracts.filter(c => c.phase_id === phase.id),
        start: phase.start_date ?? null,
        end: phase.end_date ?? null,
      }))

  // A row with no contract value — a supplier paid without a contract (has_contract false), or a
  // draft paid before its amount was entered — is work bought as it was paid for: worth what was
  // paid and done. Left at 0 it was spent money that could never be earned, which sank CPI once
  // completion was measured against the plan (GEN-23).
  const value = (c: ContractWithDetails) => {
    const amount = Number(c.contract_amount || 0)
    return amount > 0 ? amount : Number(c.budget_realized || 0)
  }
  const physicalPct = (c: ContractWithDetails) => Number(c.contract_amount || 0) > 0
    ? contractPhysicalPct(c.id, Number(c.contract_amount), Number(c.budget_realized || 0), milestonesByContract)
    : 100

  measured.forEach(({ budget, contracts: phaseContracts, start, end }) => {
    const phaseCommitted = phaseContracts.reduce((sum, c) => sum + value(c), 0)
    const phaseAC = phaseContracts.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0)
    // Physical completion = contract-value-weighted average of each contract's
    // milestone-based physical progress. Independent of money spent (see
    // contractPhysicalPct), so EV no longer collapses onto AC.
    const weightedPhysical = phaseContracts.reduce((sum, c) => sum + value(c) * physicalPct(c), 0)
    // Completion is measured against the plan, not against what has been contracted so far: work
    // with no contract yet is not started. Dividing by the committed amount alone spread every
    // contract's progress over the whole budget, so a phase 15% contracted and half done read as
    // half the plan earned (GEN-23). Only when the contracts exceed the plan is their progress
    // scaled down to it, so EV never passes the budget.
    const completionBase = Math.max(phaseCommitted, budget)
    const physicalCompletionPct = completionBase > 0 ? weightedPhysical / completionBase : 0

    // EV and AC need no schedule, so they are always accumulated. Only PV depends on dates.
    //
    // Previously the whole phase was skipped when either date was missing, which meant a
    // project with undated phases reported EV = AC = 0 and therefore CPI = SPI = 1 — a
    // perfectly on-track project, regardless of reality, with nothing to indicate the figures
    // were not computed. Splitting them keeps the cost side honest and confines the gap to the
    // schedule side, which `scheduleAvailable` now reports.
    totalEV += (budget * physicalCompletionPct) / 100
    totalAC += phaseAC
    for (const c of phaseContracts) {
      if (Number(c.contract_amount || 0) <= 0) continue
      contractedAC += Number(c.budget_realized || 0)
      if (milestonesByContract.get(c.id)?.length) measuredAC += Number(c.budget_realized || 0)
    }

    if (start && end) {
      scheduledPhases += 1
      totalPV += calculatePhaseEVM(budget, physicalCompletionPct, start, end, phaseAC, currentDate).PV
    }
    totalBudget += budget
  })

  // With nothing paid there is no cost performance to report: CPI is not 1, it is unknown.
  // Callers should check `costAvailable` before presenting it (GEN-20).
  const CPI = totalAC > 0 ? totalEV / totalAC : 1
  // With no dated phase there is no schedule baseline, so SPI is not merely 1 — it is unknown.
  // Callers should check `scheduleAvailable` before presenting it.
  const SPI = totalPV > 0 ? totalEV / totalPV : 1
  const CV = totalEV - totalAC
  const SV = totalEV - totalPV
  const EAC = CPI !== 0 ? totalBudget / CPI : totalBudget
  const VAC = totalBudget - EAC

  return {
    PV: totalPV, EV: totalEV, AC: totalAC, CPI, SPI, EAC, VAC, CV, SV,
    scheduleAvailable: scheduledPhases > 0,
    costAvailable: measuredAC > 0,
    ...(measuredAC > 0 ? {} : {
      costUnavailableReason: totalAC <= 0 ? 'nothing_paid' : contractedAC <= 0 ? 'no_contract' : 'no_milestones',
    }),
  }
}
