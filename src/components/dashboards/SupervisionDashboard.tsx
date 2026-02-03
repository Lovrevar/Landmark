import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ClipboardCheck,
  Users,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Camera,
  FileText,
  HardHat,
  AlertCircle,
  Wrench,
  BarChart3,
  Activity
} from 'lucide-react'
import { format, isToday, parseISO, differenceInDays, startOfWeek, endOfWeek } from 'date-fns'

interface WorkLog {
  id: string
  date: string
  subcontractor_id: string
  subcontractor_name?: string
  work_description: string
  notes: string
  status: string
  color: string
  blocker_details?: string
  created_at: string
}

interface SubcontractorStatus {
  id: string
  name: string
  project_name: string
  deadline: string
  progress: number
  cost: number
  budget_realized: number
  days_until_deadline: number
  is_overdue: boolean
  recent_work_logs: number
  last_activity: string | null
}

interface WeeklyStats {
  completed_this_week: number
  active_crews: number
  active_sites: number
  work_logs_this_week: number
  overdue_tasks: number
  critical_deadlines: number
}

const SupervisionDashboard: React.FC = () => {
  const [weekLogs, setWeekLogs] = useState<WorkLog[]>([])
  const [subcontractorStatus, setSubcontractorStatus] = useState<SubcontractorStatus[]>([])
  const [stats, setStats] = useState<WeeklyStats>({
    completed_this_week: 0,
    active_crews: 0,
    active_sites: 0,
    work_logs_this_week: 0,
    overdue_tasks: 0,
    critical_deadlines: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'week' | 'status' | 'issues'>('week')

  useEffect(() => {
    fetchSupervisionData()
  }, [])

  const fetchSupervisionData = async () => {
    try {
      setLoading(true)

      const today = new Date()
      const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

      const { data: workLogs, error: logsError } = await supabase
        .from('work_logs')
        .select(`
          *,
          subcontractors!work_logs_subcontractor_id_fkey (name),
          contracts!work_logs_contract_id_fkey (contract_number, job_description)
        `)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('created_at', { ascending: false })

      if (logsError) throw logsError

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

      const allSubcontractors = contractsData?.map((c: any) => {
        const cost = parseFloat(c.contract_amount || 0)
        const contractInvoices = invoicesData?.filter(inv => inv.contract_id === c.id) || []
        const budgetRealized = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)
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
          project_phases: {
            project_id: c.phase?.project_id,
            projects: {
              name: c.phase?.project?.name
            }
          }
        }
      }) || []

      const logsWithNames = (workLogs || []).map(log => ({
        ...log,
        subcontractor_name: log.subcontractors?.name || 'Unknown'
      }))

      const subcontractorStatusData: SubcontractorStatus[] = await Promise.all(
        (allSubcontractors || []).map(async (sub: any) => {
          const daysUntilDeadline = differenceInDays(parseISO(sub.deadline), new Date())
          const isOverdue = daysUntilDeadline < 0 && sub.progress < 100

          const { data: recentLogs } = await supabase
            .from('work_logs')
            .select('id, date')
            .eq('subcontractor_id', sub.id)
            .gte('date', format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
            .order('date', { ascending: false })

          const lastActivity = recentLogs && recentLogs.length > 0 ? recentLogs[0].date : null

          return {
            id: sub.id,
            name: sub.name,
            project_name: sub.project_phases?.projects?.name || 'Unknown Project',
            deadline: sub.deadline,
            progress: sub.progress,
            cost: sub.cost,
            budget_realized: sub.budget_realized,
            days_until_deadline: daysUntilDeadline,
            is_overdue: isOverdue,
            recent_work_logs: recentLogs?.length || 0,
            last_activity: lastActivity
          }
        })
      )

      const completedThisWeek = (allSubcontractors || []).filter((sub: any) => {
        if (!sub.completed_at) return false
        const completedDate = parseISO(sub.completed_at)
        return completedDate >= startOfWeek(today, { weekStartsOn: 1 }) &&
               completedDate <= endOfWeek(today, { weekStartsOn: 1 })
      }).length

      const activeCrews = subcontractorStatusData.filter(s => s.progress < 100).length
      const activePhaseIds = new Set(
        (allSubcontractors || [])
          .filter((sub: any) => sub.progress < 100)
          .map((sub: any) => sub.phase_id)
      )
      const activeSites = activePhaseIds.size
      const overdueCount = subcontractorStatusData.filter(s => s.is_overdue).length
      const criticalDeadlines = subcontractorStatusData.filter(
        s => s.days_until_deadline >= 0 && s.days_until_deadline <= 7 && s.progress < 100
      ).length

      setWeekLogs(logsWithNames)
      setSubcontractorStatus(subcontractorStatusData)
      setStats({
        completed_this_week: completedThisWeek,
        active_crews: activeCrews,
        active_sites: activeSites,
        work_logs_this_week: logsWithNames.length,
        overdue_tasks: overdueCount,
        critical_deadlines: criticalDeadlines
      })
    } catch (error) {
      console.error('Error fetching supervision data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading supervision dashboard...</div>
  }

  const overdueTasks = subcontractorStatus.filter(s => s.is_overdue)
  const criticalDeadlines = subcontractorStatus.filter(
    s => s.days_until_deadline >= 0 && s.days_until_deadline <= 7 && s.progress < 100
  )
  const needsAttention = subcontractorStatus.filter(
    s => s.recent_work_logs === 0 && s.progress < 100
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Site Supervision</h1>
          <p className="text-gray-600 mt-1">Weekly operations and quality control</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">This Week</p>
          <p className="text-lg font-semibold text-gray-900">{format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd')} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd, yyyy')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed_this_week}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">This week</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Active Crews</p>
              <p className="text-2xl font-bold text-blue-600">{stats.active_crews}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">In progress</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Active Sites</p>
              <p className="text-2xl font-bold text-purple-600">{stats.active_sites}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Wrench className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Phases with work</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Work Logs</p>
              <p className="text-2xl font-bold text-teal-600">{stats.work_logs_this_week}</p>
            </div>
            <div className="p-2 bg-teal-100 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">This week</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{stats.overdue_tasks}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Need action</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-orange-600">{stats.critical_deadlines}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Due this week</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setSelectedView('week')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedView === 'week'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          This Week's Activity
        </button>
        <button
          onClick={() => setSelectedView('status')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedView === 'status'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Contractor Status
        </button>
        <button
          onClick={() => setSelectedView('issues')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedView === 'issues'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Issues & Alerts
        </button>
      </div>

      {selectedView === 'week' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
                This Week's Work Logs ({weekLogs.length})
              </h2>
            </div>
            <div className="p-6">
              {weekLogs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No work logs submitted this week</p>
                  <p className="text-sm text-gray-500">Work logs will appear here as they are submitted</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {weekLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border-l-4 rounded-lg p-4 hover:shadow-md transition-shadow bg-white border border-gray-200"
                      style={{ borderLeftColor: log.color || 'blue' }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{log.subcontractor_name}</h3>
                          {log.contracts && (
                            <p className="text-xs text-gray-500 mb-1">
                              Contract: {log.contracts.contract_number} - {log.contracts.job_description}
                            </p>
                          )}
                          <p className="text-sm text-gray-600 mt-2">{log.work_description}</p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                          {format(new Date(log.created_at), 'HH:mm')}
                        </span>
                      </div>

                      {log.blocker_details && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-3">
                          <p className="text-xs font-medium text-red-800 mb-1">Issue Details:</p>
                          <p className="text-sm text-red-700">{log.blocker_details}</p>
                        </div>
                      )}

                      {log.notes && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                          <p className="text-sm text-gray-600">{log.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedView === 'status' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                Subcontractor Performance Overview
              </h2>
            </div>
            <div className="p-6">
              {subcontractorStatus.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No subcontractors found</p>
              ) : (
                <div className="space-y-3">
                  {subcontractorStatus.map((sub) => (
                    <div
                      key={sub.id}
                      className={`border rounded-lg p-4 ${
                        sub.is_overdue
                          ? 'border-red-300 bg-red-50'
                          : sub.days_until_deadline <= 7 && sub.progress < 100
                          ? 'border-orange-300 bg-orange-50'
                          : sub.progress === 100
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                            {sub.progress === 100 && (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            )}
                            {sub.is_overdue && (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{sub.project_name}</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            sub.progress === 100 ? 'text-green-600' :
                            sub.is_overdue ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {sub.progress}%
                          </div>
                          <p className="text-xs text-gray-500">Complete</p>
                        </div>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full ${
                            sub.progress === 100 ? 'bg-green-600' :
                            sub.is_overdue ? 'bg-red-600' :
                            'bg-blue-600'
                          }`}
                          style={{ width: `${sub.progress}%` }}
                        ></div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-gray-600">Deadline</p>
                          <p className={`text-sm font-medium ${
                            sub.is_overdue ? 'text-red-600' :
                            sub.days_until_deadline <= 7 ? 'text-orange-600' :
                            'text-gray-900'
                          }`}>
                            {format(parseISO(sub.deadline), 'MMM dd')}
                            {sub.is_overdue && (
                              <span className="ml-1">({Math.abs(sub.days_until_deadline)}d over)</span>
                            )}
                            {!sub.is_overdue && sub.days_until_deadline <= 7 && (
                              <span className="ml-1">({sub.days_until_deadline}d left)</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Budget Used</p>
                          <p className="text-sm font-medium text-gray-900">
                            {((sub.budget_realized / sub.cost) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Last Activity</p>
                          <p className="text-sm font-medium text-gray-900">
                            {sub.last_activity ? format(parseISO(sub.last_activity), 'MMM dd') : 'No logs'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Weekly Logs</p>
                          <p className="text-sm font-medium text-gray-900">{sub.recent_work_logs}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedView === 'issues' && (
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200">
              <div className="p-6 border-b border-red-200 bg-red-50">
                <h2 className="text-xl font-semibold text-red-900 flex items-center">
                  <XCircle className="w-5 h-5 mr-2" />
                  Overdue Tasks ({overdueTasks.length})
                </h2>
              </div>
              <div className="p-6 space-y-3">
                {overdueTasks.map((sub) => (
                  <div key={sub.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{sub.project_name}</p>
                        <p className="text-sm text-red-600 font-medium mt-2">
                          {Math.abs(sub.days_until_deadline)} days overdue • {sub.progress}% complete
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Deadline was</p>
                        <p className="text-sm font-medium text-red-700">
                          {format(parseISO(sub.deadline), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {criticalDeadlines.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-orange-200">
              <div className="p-6 border-b border-orange-200 bg-orange-50">
                <h2 className="text-xl font-semibold text-orange-900 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Critical Deadlines - Next 7 Days ({criticalDeadlines.length})
                </h2>
              </div>
              <div className="p-6 space-y-3">
                {criticalDeadlines.map((sub) => (
                  <div key={sub.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{sub.project_name}</p>
                        <p className="text-sm text-orange-600 font-medium mt-2">
                          {sub.days_until_deadline} days remaining • {sub.progress}% complete
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Due</p>
                        <p className="text-sm font-medium text-orange-700">
                          {format(parseISO(sub.deadline), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {needsAttention.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-yellow-200">
              <div className="p-6 border-b border-yellow-200 bg-yellow-50">
                <h2 className="text-xl font-semibold text-yellow-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  No Recent Activity ({needsAttention.length})
                </h2>
              </div>
              <div className="p-6 space-y-3">
                {needsAttention.map((sub) => (
                  <div key={sub.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{sub.project_name}</p>
                        <p className="text-sm text-yellow-600 font-medium mt-2">
                          No work logs this week • {sub.progress}% complete
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Last activity</p>
                        <p className="text-sm font-medium text-yellow-700">
                          {sub.last_activity ? format(parseISO(sub.last_activity), 'MMM dd') : 'None'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {overdueTasks.length === 0 && criticalDeadlines.length === 0 && needsAttention.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clear!</h3>
              <p className="text-gray-600">No critical issues or alerts at this time</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SupervisionDashboard
