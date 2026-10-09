import { supabase } from '../../../../lib/supabase'
import { daysFromToday } from '../../../../utils/dateOnly'
import type { ProjectWithFinancials } from '../../../General/Projects/types'
import { weightedAverageInterestRate } from '../utils/weightedInterestRate'
import { fetchBudgetedProjectIds } from '../../../Supervision/SiteManagement/services/siteService'

export async function fetchInvestmentProjects(): Promise<ProjectWithFinancials[]> {
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('start_date', { ascending: false })
  if (projectsError) throw projectsError

  const { data: allocationsData, error: allocationsError } = await supabase
    .from('credit_allocations')
    .select(`
      *,
      credit:bank_credits(
        id,
        credit_name,
        credit_type,
        interest_rate,
        start_date,
        maturity_date,
        usage_expiration_date,
        outstanding_balance,
        monthly_payment,
        repayment_type,
        bank:banks(*)
      )
    `)
  if (allocationsError) throw allocationsError

  // Only a TIC sets a budget. Without one the ratios below have nothing to divide by: the screen
  // used to show €0, "0 % funded" and a High risk badge for a project nobody had budgeted (FUND-10).
  const budgetedProjectIds = await fetchBudgetedProjectIds()

  return (projectsData || []).map(project => {
    const budget_set = budgetedProjectIds.has(project.id)
    const projectAllocations = (allocationsData || []).filter(alloc => alloc.project_id === project.id)

    const debtAllocations = projectAllocations.filter(alloc => alloc.credit?.credit_type !== 'equity')
    const equityAllocations = projectAllocations.filter(alloc => alloc.credit?.credit_type === 'equity')

    const total_debt = debtAllocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
    // total_investment represents equity financing (kept distinct from debt)
    const total_investment = equityAllocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
    // funding_ratio now reflects all financing (debt + equity) against budget
    const funding_ratio = budget_set && project.budget > 0 ? ((total_debt + total_investment) / project.budget) * 100 : 0
    const debt_to_equity = total_investment > 0 ? total_debt / total_investment : 0
    // Debt only, weighted by allocated amount — equity rows carry no interest rate and used to
    // drag the "ponderirani prosjek" caption's number toward zero.
    const avg_interest_rate = weightedAverageInterestRate(debtAllocations)

    const uniqueBanks = projectAllocations
      .filter(alloc => alloc.credit?.bank)
      .map(alloc => alloc.credit.bank)
      .filter((bank, index, self) => index === self.findIndex(b => b.id === bank.id))

    const debtRatio = budget_set && project.budget > 0 ? (total_debt / project.budget) * 100 : 0
    // Days past the end date. `new Date('YYYY-MM-DD')` parses as UTC midnight, so east of
    // UTC a project read as overrun from 01:00 on its own end date.
    const timeOverrun = project.end_date ? -daysFromToday(project.end_date) : 0

    let risk_level: 'Low' | 'Medium' | 'High' = 'Low'
    // Underfunding is only a finding against a budget; without one, risk rests on the schedule.
    const underfunded = (below: number) => budget_set && funding_ratio < below
    if (debtRatio > 70 || timeOverrun > 30 || underfunded(80)) risk_level = 'High'
    else if (debtRatio > 50 || timeOverrun > 0 || underfunded(90)) risk_level = 'Medium'

    return {
      ...project,
      budget_set,
      total_investment,
      total_debt,
      debt_allocations: projectAllocations,
      banks: uniqueBanks,
      funding_ratio,
      debt_to_equity,
      avg_interest_rate,
      risk_level
    }
  })
}
