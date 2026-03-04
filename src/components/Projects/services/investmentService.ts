import { supabase } from '../../../lib/supabase'
import { differenceInDays } from 'date-fns'
import type { ProjectWithFinancials, FundingUtilizationItem } from '../types'

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

  return (projectsData || []).map(project => {
    const projectAllocations = (allocationsData || []).filter(alloc => alloc.project_id === project.id)

    const total_debt = projectAllocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
    const total_investment = total_debt
    const funding_ratio = project.budget > 0 ? (total_debt / project.budget) * 100 : 0
    const debt_to_equity = 0
    const expected_roi = projectAllocations.length > 0
      ? projectAllocations.reduce((sum, alloc) => sum + (alloc.credit?.interest_rate || 0), 0) / projectAllocations.length
      : 0

    const uniqueBanks = projectAllocations
      .filter(alloc => alloc.credit?.bank)
      .map(alloc => alloc.credit.bank)
      .filter((bank, index, self) => index === self.findIndex(b => b.id === bank.id))

    const debtRatio = project.budget > 0 ? (total_debt / project.budget) * 100 : 0
    const timeOverrun = project.end_date ? differenceInDays(new Date(), new Date(project.end_date)) : 0

    let risk_level: 'Low' | 'Medium' | 'High' = 'Low'
    if (debtRatio > 70 || timeOverrun > 30 || funding_ratio < 80) risk_level = 'High'
    else if (debtRatio > 50 || timeOverrun > 0 || funding_ratio < 90) risk_level = 'Medium'

    return {
      ...project,
      total_investment,
      total_debt,
      debt_allocations: projectAllocations,
      banks: uniqueBanks,
      funding_ratio,
      debt_to_equity,
      expected_roi,
      risk_level
    }
  })
}

export async function fetchFundingUtilization(projectId: string): Promise<FundingUtilizationItem[]> {
  const { data: allocationsData, error } = await supabase
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
        bank:banks(*)
      )
    `)
    .eq('project_id', projectId)
  if (error) throw error

  const utilization: FundingUtilizationItem[] = []
  ;(allocationsData || []).forEach(allocation => {
    if (!allocation.credit?.bank) return
    utilization.push({
      id: allocation.id,
      type: 'bank',
      name: `${allocation.credit.bank.name} - ${allocation.credit.credit_name}`,
      totalAmount: allocation.allocated_amount,
      spentAmount: allocation.used_amount,
      availableAmount: allocation.allocated_amount - allocation.used_amount,
      usageExpirationDate: allocation.credit.usage_expiration_date,
      investmentDate: allocation.credit.start_date
    })
  })
  return utilization
}
