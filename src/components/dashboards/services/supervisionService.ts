import { supabase } from '../../../lib/supabase'
import { format, startOfWeek, endOfWeek, differenceInDays, parseISO } from 'date-fns'
import type { WorkLog, SubcontractorStatus, WeeklyStats } from '../types/supervisionTypes'

export async function fetchWeekLogs(): Promise<WorkLog[]> {
  const today = new Date()
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data: workLogs, error } = await supabase
    .from('work_logs')
    .select(`
      *,
      subcontractors!work_logs_subcontractor_id_fkey (name),
      contracts!work_logs_contract_id_fkey (contract_number, job_description)
    `)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (workLogs || []).map(log => ({
    ...log,
    subcontractor_name: log.subcontractors?.name || 'Unknown'
  }))
}

export async function fetchContractStatusData() {
  const { data: contractsData, error: subError } = await supabase
    .from('contracts')
    .select(`
      *,
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, completed_at),
      phase:project_phases!contracts_phase_id_fkey(
        project_id,
        project:projects!project_phases_project_id_fkey(name)
      )
    `)
    .in('status', ['draft', 'active'])
    .order('end_date', { ascending: true })

  if (subError) throw subError

  const { data: invoicesData, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select('contract_id, base_amount, paid_amount, remaining_amount')
    .eq('invoice_category', 'SUBCONTRACTOR')

  if (invoicesError) throw invoicesError

  return (contractsData || []).map((c: any) => {
    const cost = parseFloat(c.contract_amount || 0)
    const contractInvoices = (invoicesData || []).filter(inv => inv.contract_id === c.id)
    let budgetRealized = 0
    if (contractInvoices.length > 0) {
      budgetRealized = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)
    } else if (c.has_contract && cost > 0) {
      budgetRealized = parseFloat(c.budget_realized || 0)
    }
    const progress = cost > 0 ? Math.min(100, (budgetRealized / cost) * 100) : 0

    return {
      id: c.id,
      subcontractor_id: c.subcontractor.id,
      name: c.subcontractor.name,
      deadline: c.end_date,
      progress,
      cost,
      budget_realized: budgetRealized,
      phase_id: c.phase_id,
      completed_at: c.subcontractor.completed_at,
      project_name: c.phase?.project?.name || 'Unknown Project'
    }
  })
}

export async function fetchSubcontractorStatus(contracts: any[]): Promise<SubcontractorStatus[]> {
  const sevenDaysAgo = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  const recentLogsResults = await Promise.all(
    contracts.map(sub =>
      supabase
        .from('work_logs')
        .select('id, date')
        .eq('subcontractor_id', sub.id)
        .gte('date', sevenDaysAgo)
        .order('date', { ascending: false })
    )
  )

  return contracts.map((sub, i) => {
    const recentLogs = recentLogsResults[i].data || []
    const daysUntilDeadline = differenceInDays(parseISO(sub.deadline), new Date())
    const isOverdue = daysUntilDeadline < 0 && sub.progress < 100
    const lastActivity = recentLogs.length > 0 ? recentLogs[0].date : null

    return {
      id: sub.id,
      name: sub.name,
      project_name: sub.project_name,
      deadline: sub.deadline,
      progress: sub.progress,
      cost: sub.cost,
      budget_realized: sub.budget_realized,
      days_until_deadline: daysUntilDeadline,
      is_overdue: isOverdue,
      recent_work_logs: recentLogs.length,
      last_activity: lastActivity
    }
  })
}

export function buildWeeklyStats(
  contracts: any[],
  subcontractorStatus: SubcontractorStatus[],
  weekLogs: WorkLog[]
): WeeklyStats {
  const today = new Date()
  const completedThisWeek = contracts.filter(sub => {
    if (!sub.completed_at) return false
    const completedDate = parseISO(sub.completed_at)
    return completedDate >= startOfWeek(today, { weekStartsOn: 1 }) &&
           completedDate <= endOfWeek(today, { weekStartsOn: 1 })
  }).length

  const activeCrews = subcontractorStatus.filter(s => s.progress < 100).length
  const activePhaseIds = new Set(contracts.filter(sub => sub.progress < 100).map(sub => sub.phase_id))
  const overdueCount = subcontractorStatus.filter(s => s.is_overdue).length
  const criticalDeadlines = subcontractorStatus.filter(
    s => s.days_until_deadline >= 0 && s.days_until_deadline <= 7 && s.progress < 100
  ).length

  return {
    completed_this_week: completedThisWeek,
    active_crews: activeCrews,
    active_sites: activePhaseIds.size,
    work_logs_this_week: weekLogs.length,
    overdue_tasks: overdueCount,
    critical_deadlines: criticalDeadlines
  }
}
