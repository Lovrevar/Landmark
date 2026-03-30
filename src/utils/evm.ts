import type { Phase, ContractWithDetails } from '../components/General/Projects/types'

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

export function calculateProjectEVM(
  phases: Phase[],
  contracts: ContractWithDetails[]
): EVMMetrics {
  let totalPV = 0, totalEV = 0, totalAC = 0, totalBudget = 0

  phases.forEach(phase => {
    const phaseContracts = contracts.filter(c => c.phase?.phase_name === phase.phase_name)
    const phaseCommitted = phaseContracts.reduce((sum, c) => sum + Number(c.contract_amount || 0), 0)
    const phaseAC = phaseContracts.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0)
    // Derive physical completion from financial progress (budget_realized / contract_amount)
    const physicalCompletionPct = phaseCommitted > 0
      ? Math.min(100, (phaseAC / phaseCommitted) * 100)
      : 0

    if (phase.start_date && phase.end_date) {
      const phaseMetrics = calculatePhaseEVM(
        Number(phase.budget_allocated),
        physicalCompletionPct,
        phase.start_date,
        phase.end_date,
        phaseAC
      )
      totalPV += phaseMetrics.PV
      totalEV += phaseMetrics.EV
      totalAC += phaseMetrics.AC
    }
    totalBudget += Number(phase.budget_allocated)
  })

  const CPI = totalAC > 0 ? totalEV / totalAC : 1
  const SPI = totalPV > 0 ? totalEV / totalPV : 1
  const CV = totalEV - totalAC
  const SV = totalEV - totalPV
  const EAC = CPI !== 0 ? totalBudget / CPI : totalBudget
  const VAC = totalBudget - EAC

  return { PV: totalPV, EV: totalEV, AC: totalAC, CPI, SPI, EAC, VAC, CV, SV }
}
