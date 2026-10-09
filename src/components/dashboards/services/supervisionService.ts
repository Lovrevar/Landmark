import { isDueThisWeek } from '../utils/supervisionDeadlines'
import { supabase } from '../../../lib/supabase'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { daysFromToday } from '../../../utils/dateOnly'
import type { WorkLog, SubcontractorStatus, WeeklyStats } from '../types/supervisionTypes'

interface ContractStatus {
  id: string
  subcontractor_id: string
  name: string
  deadline: string | undefined
  progress: number
  cost: number
  budget_realized: number
  phase_id: string | undefined
  project_name: string
}

interface RecentLog {
  id: string
  date: string
}

export interface SupervisionDashboardData {
  weekLogs: WorkLog[]
  subcontractorStatus: SubcontractorStatus[]
  stats: WeeklyStats
}

export async function fetchSupervisionDashboard(): Promise<SupervisionDashboardData> {
  const today = new Date()
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [
    { data: weekLogsData, error: weekLogsError },
    { data: contractsData, error: contractsError },
    { data: recentLogsData, error: recentLogsError },
  ] = await Promise.all([
    supabase
      .from('work_logs')
      .select(
        'id, date, subcontractor_id, work_description, notes, status, blocker_details, created_at, subcontractors!work_logs_subcontractor_id_fkey(name), contracts!work_logs_contract_id_fkey(contract_number, job_description)'
      )
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date', { ascending: false }),
    supabase
      .from('contracts')
      .select(
        'id, status, end_date, contract_amount, has_contract, budget_realized, phase_id, subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name), phase:project_phases!contracts_phase_id_fkey(project_id, project:projects!project_phases_project_id_fkey(name))'
      )
      .in('status', ['draft', 'active'])
      .order('end_date', { ascending: true }),
    // Recent-activity logs use the SAME calendar week as everything else, so the
    // "weekly logs" / "no work logs this week" labels match the header range.
    supabase
      .from('work_logs')
      .select('id, date, subcontractor_id')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date', { ascending: false }),
  ])

  if (weekLogsError) throw weekLogsError
  if (contractsError) throw contractsError
  if (recentLogsError) throw recentLogsError

  // Crews that logged finished work this week. subcontractors.completed_at, the previous source,
  // is never written by the app, so the card always read 0.
  const completedThisWeek = new Set(
    (weekLogsData || [])
      .filter(log => log.status === 'work_finished' && log.subcontractor_id)
      .map(log => log.subcontractor_id)
  ).size

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weekLogs: WorkLog[] = (weekLogsData || []).map((log: any) => ({
    ...log,
    subcontractor_name: log.subcontractors?.name || 'Unknown'
  }))

  const recentLogsBySubcontractor = new Map<string, RecentLog[]>()
  for (const log of recentLogsData || []) {
    if (!log.subcontractor_id) continue
    const bucket = recentLogsBySubcontractor.get(log.subcontractor_id)
    if (bucket) bucket.push(log)
    else recentLogsBySubcontractor.set(log.subcontractor_id, [log])
  }

  const contractsStatus = deriveContractStatus(contractsData || [])
  const subcontractorStatus = deriveSubcontractorStatus(contractsStatus, recentLogsBySubcontractor)
  const stats = buildWeeklyStats(contractsStatus, subcontractorStatus, weekLogs, completedThisWeek)

  return { weekLogs, subcontractorStatus, stats }
}

function deriveContractStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contracts: any[]
): ContractStatus[] {
  return contracts.map(c => {
    const cost = parseFloat(c.contract_amount || 0)
    // `contracts.budget_realized` is the one paid figure, kept by the payment triggers. This
    // used to sum `paid_amount` over the contract's invoices when it had any, which is a
    // different number whenever a payment is not tied to an invoice of the same contract
    // (GEN-10).
    const budgetRealized = parseFloat(c.budget_realized || 0)
    const progress = cost > 0 ? Math.round(Math.min(100, (budgetRealized / cost) * 100)) : 0

    return {
      id: c.id,
      subcontractor_id: c.subcontractor.id,
      name: c.subcontractor.name,
      deadline: c.end_date,
      progress,
      cost,
      budget_realized: budgetRealized,
      phase_id: c.phase_id,
      project_name: c.phase?.project?.name || null
    }
  })
}

function deriveSubcontractorStatus(
  contracts: ContractStatus[],
  recentLogsBySubcontractor: Map<string, RecentLog[]>
): SubcontractorStatus[] {
  return contracts.map(sub => {
    const recentLogs = recentLogsBySubcontractor.get(sub.subcontractor_id) || []
    const daysUntilDeadline = sub.deadline ? daysFromToday(sub.deadline) : null
    const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0 && sub.progress < 100
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

function buildWeeklyStats(
  contracts: ContractStatus[],
  subcontractorStatus: SubcontractorStatus[],
  weekLogs: WorkLog[],
  completedThisWeek: number
): WeeklyStats {
  // Distinct subcontractors with in-progress work (not one entry per contract).
  const activeCrews = new Set(
    contracts.filter(sub => sub.progress < 100).map(sub => sub.subcontractor_id)
  ).size
  // Distinct phases with active work — ignore contracts with no phase so a null
  // phase_id doesn't collapse into one phantom "site".
  const activePhaseIds = new Set(
    contracts.filter(sub => sub.progress < 100 && sub.phase_id).map(sub => sub.phase_id)
  )
  const overdueCount = subcontractorStatus.filter(s => s.is_overdue).length
  const criticalDeadlines = subcontractorStatus.filter(isDueThisWeek).length

  return {
    completed_this_week: completedThisWeek,
    active_crews: activeCrews,
    active_sites: activePhaseIds.size,
    work_logs_this_week: weekLogs.length,
    overdue_tasks: overdueCount,
    critical_deadlines: criticalDeadlines
  }
}
