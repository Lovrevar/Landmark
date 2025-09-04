import React, { useState, useEffect } from 'react'
import { supabase, Subcontractor, Task } from '../../lib/supabase'
import { Users, Clock, DollarSign, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

const SupervisionDashboard: React.FC = () => {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState({
    totalSubcontractors: 0,
    onTimeProjects: 0,
    overdueProjects: 0,
    totalCosts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch subcontractors
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('deadline', { ascending: true })

      if (subError) throw subError

      // Fetch tasks
      const { data: tasksData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .order('deadline', { ascending: true })

      if (taskError) throw taskError

      setSubcontractors(subcontractorsData || [])
      setTasks(tasksData || [])

      // Calculate stats
      const totalSubcontractors = subcontractorsData?.length || 0
      const onTimeProjects = subcontractorsData?.filter(sub => 
        new Date(sub.deadline) >= new Date() || sub.progress === 100
      ).length || 0
      const overdueProjects = subcontractorsData?.filter(sub => 
        new Date(sub.deadline) < new Date() && sub.progress < 100
      ).length || 0
      const totalCosts = subcontractorsData?.reduce((sum, sub) => sum + sub.cost, 0) || 0

      setStats({ totalSubcontractors, onTimeProjects, overdueProjects, totalCosts })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProgress = async (subcontractorId: string, newProgress: number) => {
    const { error } = await supabase
      .from('subcontractors')
      .update({ progress: newProgress })
      .eq('id', subcontractorId)

    if (!error) {
      fetchData()
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSubcontractors}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">On Time</p>
              <p className="text-2xl font-bold text-gray-900">{stats.onTimeProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overdueProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Costs</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats.totalCosts.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subcontractors Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Subcontractor Overview</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contractor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subcontractors.map((subcontractor) => {
                const isOverdue = new Date(subcontractor.deadline) < new Date() && subcontractor.progress < 100
                const isCompleted = subcontractor.progress === 100
                return (
                  <tr key={subcontractor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{subcontractor.name}</div>
                        <div className="text-sm text-gray-500">{subcontractor.contact}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {subcontractor.job_description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isCompleted ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${subcontractor.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">{subcontractor.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(subcontractor.deadline), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${subcontractor.cost.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        isCompleted ? 'bg-green-100 text-green-800' :
                        isOverdue ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'In Progress'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          const newProgress = prompt(`Update progress for ${subcontractor.name} (0-100):`, subcontractor.progress.toString())
                          if (newProgress !== null) {
                            const progress = Math.min(100, Math.max(0, parseInt(newProgress) || 0))
                            updateProgress(subcontractor.id, progress)
                          }
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-xs font-medium transition-colors duration-200"
                      >
                        Update Progress
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SupervisionDashboard