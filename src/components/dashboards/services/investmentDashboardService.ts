import { supabase } from '../../../lib/supabase'
import { daysFromToday } from '../../../utils/dateOnly'
import type { Project, Company, Bank, BankCredit, FinancialSummary, RecentActivity } from '../../../types/investment'

export interface InvestmentDashboardData {
  projects: Project[]
  companies: Company[]
  banks: Bank[]
  bankCredits: BankCredit[]
  recentActivities: RecentActivity[]
  financialSummary: FinancialSummary
}

export async function fetchInvestmentDashboardData(): Promise<InvestmentDashboardData> {
  const [
    { data: projectsData },
    { data: companiesData },
    { data: banksData },
    { data: creditsData }
  ] = await Promise.all([
    supabase.from('projects').select('*').order('start_date', { ascending: false }),
    supabase.from('accounting_companies').select('*').order('name'),
    supabase.from('banks').select('*').order('name'),
    supabase.from('bank_credits').select(`
      *,
      company:accounting_companies(id, name, oib),
      project:projects(id, name, location, budget, status),
      credit_allocations:credit_allocations(
        id,
        credit_id,
        project_id,
        allocated_amount,
        used_amount,
        description,
        project:projects(id, name, location, budget, status)
      )
    `).order('created_at', { ascending: false })
  ])

  const projects = projectsData || []
  const companies = companiesData || []
  const banks = banksData || []
  const credits = creditsData || []

  const total_portfolio_value = projects.reduce((sum, p) => sum + Number(p.budget), 0)
  const total_credit_lines = credits.reduce((sum, c) => sum + Number(c.amount), 0)
  const total_used_credit = credits.reduce((sum, c) => sum + Number(c.used_amount || 0), 0)
  const total_repaid_credit = credits.reduce((sum, c) => sum + Number(c.repaid_amount || 0), 0)
  // Derive debt from used − repaid so the headline KPI is always consistent with
  // the Used/Repaid tiles, rather than trusting a separately-stored balance.
  const total_outstanding_debt = Math.max(0, total_used_credit - total_repaid_credit)
  // Available headroom can't be negative; an over-drawn facility is an alarm, not
  // negative "available". Utilization >100% is surfaced separately.
  const available_credit = Math.max(0, total_credit_lines - total_used_credit)
  // Amount-weighted, not a simple mean (which a tiny high-rate facility skews).
  const weighted_avg_interest = total_credit_lines > 0
    ? credits.reduce((sum, c) => sum + Number(c.interest_rate || 0) * Number(c.amount || 0), 0) / total_credit_lines
    : 0
  const isUpcoming = (date: string | null | undefined): boolean => {
    if (!date) return false
    const d = daysFromToday(date)
    return d >= 0 && d <= 90
  }
  const upcoming_maturities = credits.filter(c => isUpcoming(c.maturity_date)).length

  const activities: RecentActivity[] = []

  // Sort on copies — never mutate the `credits` array that is returned as
  // bankCredits and consumed by the table and PDF.
  ;[...credits]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)
    .forEach(credit => {
      activities.push({
        id: credit.id,
        type: 'credit',
        title: 'Credit facility approved',
        description: `${credit.company?.name || 'Company'} - €${(Number(credit.amount) / 1000000).toFixed(1)}M ${credit.credit_type.replace(/_/g, ' ')}${credit.project ? ` for ${credit.project.name}` : ''}`,
        date: credit.start_date,
        amount: Number(credit.amount)
      })
    })

  ;[...credits]
    .filter(c => isUpcoming(c.maturity_date))
    .sort((a, b) => new Date(a.maturity_date!).getTime() - new Date(b.maturity_date!).getTime())
    .slice(0, 3)
    .forEach(credit => {
      const daysUntil = daysFromToday(credit.maturity_date!)
      activities.push({
        id: credit.id + '_maturity',
        type: 'maturity',
        title: 'Upcoming loan maturity',
        description: `${credit.credit_name || credit.company?.name || 'Credit'} matures in ${daysUntil} days`,
        date: credit.maturity_date!
      })
    })

  ;[...credits]
    .filter(c => isUpcoming(c.usage_expiration_date))
    .sort((a, b) => new Date(a.usage_expiration_date!).getTime() - new Date(b.usage_expiration_date!).getTime())
    .slice(0, 2)
    .forEach(credit => {
      const daysUntil = daysFromToday(credit.usage_expiration_date!)
      activities.push({
        id: credit.id + '_usage',
        type: 'usage_expiring',
        title: 'Credit usage period expiring',
        description: `${credit.credit_name || credit.company?.name || 'Credit'} usage expires in ${daysUntil} days`,
        date: credit.usage_expiration_date!
      })
    })

  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    projects,
    companies,
    banks,
    bankCredits: credits,
    recentActivities: activities.slice(0, 5),
    financialSummary: {
      total_portfolio_value,
      total_debt: total_outstanding_debt,
      total_equity: 0,
      debt_to_equity_ratio: 0,
      weighted_avg_interest,
      upcoming_maturities,
      total_credit_lines,
      available_credit,
      total_used_credit,
      total_repaid_credit
    }
  }
}
