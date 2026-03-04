import { supabase } from '../../../lib/supabase'
import type { Project } from '../../../lib/supabase'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import type { ProjectSupervisionReport, MonthlyData } from '../types'

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export async function generateProjectReport(
  selectedProject: string,
  projects: Project[],
  dateRange: { start: string; end: string }
): Promise<ProjectSupervisionReport> {
  const project = projects.find(p => p.id === selectedProject)
  if (!project) throw new Error('Project not found')

  const { data: contractsData, error: contractsError } = await supabase
    .from('contracts')
    .select('*')
    .eq('project_id', selectedProject)

  if (contractsError) throw contractsError

  const { data: phasesData, error: phasesError } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', selectedProject)

  if (phasesError) throw phasesError

  const { data: paymentsData, error: paymentsError } = await supabase
    .from('subcontractor_payments')
    .select(`*, contracts!inner(project_id)`)
    .eq('contracts.project_id', selectedProject)

  if (paymentsError) throw paymentsError

  const { data: subcontractorsData, error: subcontractorsError } = await supabase
    .from('subcontractors')
    .select('*')

  if (subcontractorsError) throw subcontractorsError

  const { data: workLogsData, error: workLogsError } = await supabase
    .from('work_logs')
    .select(`
      *,
      subcontractors!work_logs_subcontractor_id_fkey (name),
      contracts!work_logs_contract_id_fkey (contract_number, job_description)
    `)
    .eq('project_id', selectedProject)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('date', { ascending: false })

  if (workLogsError) throw workLogsError

  const { data: bankCreditsData, error: bankCreditsError } = await supabase
    .from('bank_credits')
    .select('*, banks(name)')
    .eq('project_id', selectedProject)

  if (bankCreditsError) throw bankCreditsError

  const { data: allocationsData, error: allocationsError } = await supabase
    .from('credit_allocations')
    .select('*, bank_credits(banks(name))')
    .eq('project_id', selectedProject)

  if (allocationsError) throw allocationsError

  const contracts = contractsData || []
  const phases = phasesData || []
  const payments = paymentsData || []
  const subcontractors = subcontractorsData || []
  const work_logs = workLogsData || []

  const contractSubcontractorIds = contracts.map(c => c.subcontractor_id)
  const projectSubcontractors = subcontractors.filter(s =>
    contractSubcontractorIds.includes(s.id)
  )

  const total_budget = project.budget
  const budget_used = contracts.reduce((sum, c) => sum + c.budget_realized, 0)
  const remaining_budget = total_budget - budget_used
  const total_contracts = contracts.length
  const active_contracts = contracts.filter(c => c.status === 'active').length
  const completed_contracts = contracts.filter(c => c.status === 'completed').length
  const total_phases = phases.length
  const completed_phases = phases.filter(p => p.status === 'completed').length
  const total_subcontractors = projectSubcontractors.length
  const total_payments = payments.reduce((sum, p) => sum + p.amount, 0)
  const total_work_logs = work_logs.length

  const investorNames: string[] = []
  if (bankCreditsData && bankCreditsData.length > 0) {
    bankCreditsData.forEach(bc => {
      if (bc.banks?.name && !investorNames.includes(bc.banks.name)) {
        investorNames.push(bc.banks.name)
      }
    })
  }
  if (allocationsData && allocationsData.length > 0) {
    allocationsData.forEach(alloc => {
      const bankName = (alloc.bank_credits as any)?.banks?.name
      if (bankName && !investorNames.includes(bankName)) {
        investorNames.push(bankName)
      }
    })
  }
  const investorsString = investorNames.length > 0 ? investorNames.join(', ') : 'N/A'

  const startDate = new Date(dateRange.start)
  const endDate = new Date(dateRange.end)
  const months = eachMonthOfInterval({ start: startDate, end: endDate })

  const monthly_data: MonthlyData[] = months.map(month => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)

    const monthPayments = payments.filter(payment => {
      if (!payment.payment_date) return false
      const paymentDate = new Date(payment.payment_date)
      return paymentDate >= monthStart && paymentDate <= monthEnd &&
             paymentDate >= startDate && paymentDate <= endDate
    })

    const activeContracts = contracts.filter(contract => {
      const subcontractor = subcontractors.find(s => s.id === contract.subcontractor_id)
      if (!subcontractor || !subcontractor.deadline) return false
      const deadline = new Date(subcontractor.deadline)
      return deadline >= monthStart
    })

    const paidSubcontractorIds = new Set(
      monthPayments.map(p => p.subcontractor_id).filter(Boolean)
    )
    const paidSubcontractorNames = projectSubcontractors
      .filter(s => paidSubcontractorIds.has(s.id))
      .map(s => s.name)
      .filter((name, index, self) => self.indexOf(name) === index)
      .join(', ')

    return {
      month: format(month, 'MMM yyyy'),
      contracts: activeContracts.length,
      payments: monthPayments.reduce((sum, p) => sum + p.amount, 0),
      subcontractors_paid: paidSubcontractorNames || 'None'
    }
  })

  return {
    project,
    total_budget,
    budget_used,
    remaining_budget,
    total_contracts,
    active_contracts,
    completed_contracts,
    total_phases,
    completed_phases,
    total_subcontractors,
    total_payments,
    total_work_logs,
    monthly_data,
    contracts,
    phases,
    subcontractors: projectSubcontractors,
    payments,
    work_logs,
    investors: investorsString
  }
}
