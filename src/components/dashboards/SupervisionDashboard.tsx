import React, { useState, useEffect } from 'react'
import { LoadingSpinner } from '../ui'
import StatCard from '../ui/StatCard'
import {
  ClipboardCheck,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wrench,
  BarChart3,
  Activity,
  AlertCircle
} from 'lucide-react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import type { WorkLog, SubcontractorStatus, WeeklyStats } from './types/supervisionTypes'
import * as supervisionService from './services/supervisionService'
import SupervisionWeekView from './sections/SupervisionWeekView'
import SupervisionStatusView from './sections/SupervisionStatusView'
import SupervisionIssuesView from './sections/SupervisionIssuesView'

const defaultStats: WeeklyStats = {
  completed_this_week: 0,
  active_crews: 0,
  active_sites: 0,
  work_logs_this_week: 0,
  overdue_tasks: 0,
  critical_deadlines: 0
}

const statCards = [
  { key: 'completed_this_week', label: 'Completed', sub: 'This week', Icon: CheckCircle2, color: 'green' as const },
  { key: 'active_crews', label: 'Active Crews', sub: 'In progress', Icon: Users, color: 'blue' as const },
  { key: 'active_sites', label: 'Active Sites', sub: 'Phases with work', Icon: Wrench, color: 'teal' as const },
  { key: 'work_logs_this_week', label: 'Work Logs', sub: 'This week', Icon: ClipboardCheck, color: 'teal' as const },
  { key: 'overdue_tasks', label: 'Overdue', sub: 'Need action', Icon: AlertTriangle, color: 'red' as const },
  { key: 'critical_deadlines', label: 'Critical', sub: 'Due this week', Icon: Clock, color: 'orange' as const }
]

const SupervisionDashboard: React.FC = () => {
  const [weekLogs, setWeekLogs] = useState<WorkLog[]>([])
  const [subcontractorStatus, setSubcontractorStatus] = useState<SubcontractorStatus[]>([])
  const [stats, setStats] = useState<WeeklyStats>(defaultStats)
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'week' | 'status' | 'issues'>('week')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [logs, contracts] = await Promise.all([
        supervisionService.fetchWeekLogs(),
        supervisionService.fetchContractStatusData()
      ])
      const statusData = await supervisionService.fetchSubcontractorStatus(contracts)
      const weeklyStats = supervisionService.buildWeeklyStats(contracts, statusData, logs)
      setWeekLogs(logs)
      setSubcontractorStatus(statusData)
      setStats(weeklyStats)
    } catch (error) {
      console.error('Error fetching supervision data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading supervision dashboard..." />
  }

  const overdueTasks = subcontractorStatus.filter(s => s.is_overdue)
  const criticalDeadlines = subcontractorStatus.filter(
    s => s.days_until_deadline >= 0 && s.days_until_deadline <= 7 && s.progress < 100
  )
  const needsAttention = subcontractorStatus.filter(s => s.recent_work_logs === 0 && s.progress < 100)

  const tabClass = (view: 'week' | 'status' | 'issues') =>
    `px-4 py-2 font-medium transition-colors ${
      selectedView === view
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Site Supervision</h1>
          <p className="text-gray-600 mt-1">Weekly operations and quality control</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">This Week</p>
          <p className="text-lg font-semibold text-gray-900">
            {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd')} -{' '}
            {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd, yyyy')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {statCards.map(({ key, label, sub, Icon, color }) => (
          <StatCard
            key={key}
            label={label}
            value={stats[key]}
            subtitle={sub}
            icon={Icon}
            color={color}
            size="md"
          />
        ))}
      </div>

      <div className="flex space-x-2 border-b border-gray-200">
        <button className={tabClass('week')} onClick={() => setSelectedView('week')}>
          <Activity className="w-4 h-4 inline mr-2" />
          This Week's Activity
        </button>
        <button className={tabClass('status')} onClick={() => setSelectedView('status')}>
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Contractor Status
        </button>
        <button className={tabClass('issues')} onClick={() => setSelectedView('issues')}>
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Issues & Alerts
        </button>
      </div>

      {selectedView === 'week' && <SupervisionWeekView weekLogs={weekLogs} />}
      {selectedView === 'status' && <SupervisionStatusView subcontractorStatus={subcontractorStatus} />}
      {selectedView === 'issues' && (
        <SupervisionIssuesView
          overdueTasks={overdueTasks}
          criticalDeadlines={criticalDeadlines}
          needsAttention={needsAttention}
        />
      )}
    </div>
  )
}

export default SupervisionDashboard
