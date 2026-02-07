import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Calendar, CheckCircle, DollarSign, X } from 'lucide-react'
import { format } from 'date-fns'
import { SubcontractorMilestone } from '../../../lib/supabase'
import { MilestoneFormModal } from '../forms/MilestoneFormModal'
import {
  fetchMilestonesByContract,
  getNextMilestoneNumber,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getMilestoneStatsForContract
} from '../services/siteService'
import { MilestoneStats } from '../types/siteTypes'
import { Button, Badge, EmptyState, LoadingSpinner } from '../../ui'

interface MilestoneListProps {
  contractId: string
  subcontractorName: string
  projectName: string
  phaseName: string
  contractCost: number
  onClose: () => void
}

export const MilestoneList: React.FC<MilestoneListProps> = ({
  contractId,
  subcontractorName,
  projectName,
  phaseName,
  contractCost,
  onClose
}) => {
  const [milestones, setMilestones] = useState<SubcontractorMilestone[]>([])
  const [stats, setStats] = useState<MilestoneStats | null>(null)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<SubcontractorMilestone | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMilestones()
  }, [contractId])

  const loadMilestones = async () => {
    try {
      setLoading(true)
      const data = await fetchMilestonesByContract(contractId)
      setMilestones(data)

      const statsData = await getMilestoneStatsForContract(contractId, contractCost)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading milestones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMilestone = async (data: any) => {
    try {
      const milestoneNumber = await getNextMilestoneNumber(contractId)
      await createMilestone({
        ...data,
        milestone_number: milestoneNumber
      })
      setShowMilestoneModal(false)
      loadMilestones()
    } catch (error) {
      console.error('Error creating milestone:', error)
      alert('Failed to create milestone')
    }
  }

  const handleEditMilestone = async (data: any) => {
    if (!editingMilestone) return

    try {
      await updateMilestone(editingMilestone.id, {
        milestone_name: data.milestone_name,
        description: data.description,
        percentage: data.percentage,
        due_date: data.due_date
      })
      setShowMilestoneModal(false)
      setEditingMilestone(null)
      loadMilestones()
    } catch (error) {
      console.error('Error updating milestone:', error)
      alert('Failed to update milestone')
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return

    try {
      await deleteMilestone(milestoneId)
      loadMilestones()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      alert('Failed to delete milestone')
    }
  }

  const openEditModal = (milestone: SubcontractorMilestone) => {
    setEditingMilestone(milestone)
    setShowMilestoneModal(true)
  }

  const openAddModal = () => {
    setEditingMilestone(null)
    setShowMilestoneModal(true)
  }

  const calculateAmount = (percentage: number) => {
    return (contractCost * percentage) / 100
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Payment Milestones</h3>
            <p className="text-sm text-gray-600 mt-1">
              {projectName} • {phaseName} • {subcontractorName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Contract: €{contractCost.toLocaleString('hr-HR')}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              icon={Plus}
              onClick={openAddModal}
            >
              Add Milestone
            </Button>
            <Button
              variant="ghost"
              size="icon-md"
              icon={X}
              onClick={onClose}
            />
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Total Allocated</p>
              <p className="text-lg font-bold text-gray-900">{stats.total_percentage.toFixed(2)}%</p>
              <p className="text-xs text-gray-500">€{stats.total_amount.toLocaleString('hr-HR')}</p>
            </div>
            <div className={`p-3 rounded-lg ${stats.remaining_percentage === 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
              <p className={`text-xs ${stats.remaining_percentage === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                Remaining
              </p>
              <p className={`text-lg font-bold ${stats.remaining_percentage === 0 ? 'text-green-900' : 'text-orange-900'}`}>
                {stats.remaining_percentage.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">
                €{((contractCost * stats.remaining_percentage) / 100).toLocaleString('hr-HR')}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-600">Milestones</p>
              <p className="text-lg font-bold text-blue-900">{milestones.length}</p>
              <p className="text-xs text-gray-500">
                {stats.paid_count} paid, {stats.pending_count} pending
              </p>
            </div>
            <div className="bg-teal-50 p-3 rounded-lg">
              <p className="text-xs text-teal-600">Total Paid</p>
              <p className="text-lg font-bold text-teal-900">€{stats.total_paid.toLocaleString('hr-HR')}</p>
              <p className="text-xs text-gray-500">
                {contractCost > 0 ? ((stats.total_paid / contractCost) * 100).toFixed(1) : 0}% of contract
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {milestones.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No milestones yet"
            description="Add milestones to track progress and payments."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Percentage</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Due Date</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((milestone) => {
                  const amount = calculateAmount(milestone.percentage)
                  return (
                    <tr key={milestone.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {milestone.milestone_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-gray-900">{milestone.milestone_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate">
                          {milestone.description || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-semibold text-gray-900">{milestone.percentage}%</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          €{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-600">
                          {milestone.due_date ? format(new Date(milestone.due_date), 'MMM dd, yyyy') : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={
                          milestone.status === 'paid' ? 'green' :
                          milestone.status === 'completed' ? 'blue' :
                          'gray'
                        } size="sm">
                          {milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            icon={Edit2}
                            onClick={() => openEditModal(milestone)}
                          />
                          <Button
                            variant="outline-danger"
                            size="icon-sm"
                            icon={Trash2}
                            onClick={() => handleDeleteMilestone(milestone.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={3} className="py-3 px-4 text-sm text-gray-900">Total</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900">
                    {stats?.total_percentage.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900">
                    €{stats?.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {showMilestoneModal && (
        <MilestoneFormModal
          visible={showMilestoneModal}
          onClose={() => {
            setShowMilestoneModal(false)
            setEditingMilestone(null)
          }}
          onSubmit={editingMilestone ? handleEditMilestone : handleAddMilestone}
          contractId={contractId}
          subcontractorName={subcontractorName}
          projectName={projectName}
          phaseName={phaseName}
          contractCost={contractCost}
          editingMilestone={editingMilestone ? {
            id: editingMilestone.id,
            milestone_name: editingMilestone.milestone_name,
            description: editingMilestone.description,
            percentage: editingMilestone.percentage,
            due_date: editingMilestone.due_date
          } : null}
        />
      )}
    </div>
  )
}
