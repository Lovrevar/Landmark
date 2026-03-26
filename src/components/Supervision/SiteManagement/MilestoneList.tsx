import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2, Calendar, X } from 'lucide-react'
import { format } from 'date-fns'
import { SubcontractorMilestone } from '../../../lib/supabase'
import { MilestoneFormModal } from './modals/MilestoneFormModal'
import {
  fetchMilestonesByContract,
  getNextMilestoneNumber,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getMilestoneStatsForContract
} from './services/siteService'
import { MilestoneStats, MilestoneFormData } from './types'
import { Button, Badge, EmptyState, LoadingSpinner, ConfirmDialog } from '../../ui'
import { useToast } from '../../../contexts/ToastContext'

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
  const { t } = useTranslation()
  const toast = useToast()
  const [milestones, setMilestones] = useState<SubcontractorMilestone[]>([])
  const [stats, setStats] = useState<MilestoneStats | null>(null)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<SubcontractorMilestone | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingDeleteMilestoneId, setPendingDeleteMilestoneId] = useState<string | null>(null)
  const [deletingMilestone, setDeletingMilestone] = useState(false)

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

  const handleAddMilestone = async (data: MilestoneFormData) => {
    try {
      const milestoneNumber = await getNextMilestoneNumber(contractId)
      await createMilestone({
        contract_id: data.contract_id,
        milestone_number: milestoneNumber,
        milestone_name: data.milestone_name,
        description: data.description,
        percentage: data.percentage,
        due_date: data.due_date
      })
      setShowMilestoneModal(false)
      loadMilestones()
    } catch (error) {
      console.error('Error creating milestone:', error)
      toast.error(t('supervision.site_management.milestone_list.create_error'))
    }
  }

  const handleEditMilestone = async (data: MilestoneFormData) => {
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
      toast.error(t('supervision.site_management.milestone_list.update_error'))
    }
  }

  const handleDeleteMilestone = (milestoneId: string) => {
    setPendingDeleteMilestoneId(milestoneId)
  }

  const confirmDeleteMilestone = async () => {
    if (!pendingDeleteMilestoneId) return
    setDeletingMilestone(true)
    try {
      await deleteMilestone(pendingDeleteMilestoneId)
      loadMilestones()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      toast.error(t('supervision.site_management.milestone_list.delete_error'))
    } finally {
      setDeletingMilestone(false)
      setPendingDeleteMilestoneId(null)
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
            <h3 className="text-xl font-semibold text-gray-900">{t('supervision.site_management.milestone_list.title')}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {projectName} • {phaseName} • {subcontractorName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {t('supervision.site_management.milestone_list.contract_base')}: €{contractCost.toLocaleString('hr-HR')}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              icon={Plus}
              onClick={openAddModal}
            >
              {t('supervision.site_management.milestone_list.add')}
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
              <p className="text-xs text-gray-600">{t('supervision.site_management.milestone_list.total_allocated')}</p>
              <p className="text-lg font-bold text-gray-900">{stats.total_percentage.toFixed(2)}%</p>
              <p className="text-xs text-gray-500">€{stats.total_amount.toLocaleString('hr-HR')}</p>
            </div>
            <div className={`p-3 rounded-lg ${stats.remaining_percentage === 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
              <p className={`text-xs ${stats.remaining_percentage === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {t('common.remaining')}
              </p>
              <p className={`text-lg font-bold ${stats.remaining_percentage === 0 ? 'text-green-900' : 'text-orange-900'}`}>
                {stats.remaining_percentage.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">
                €{((contractCost * stats.remaining_percentage) / 100).toLocaleString('hr-HR')}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-600">{t('supervision.site_management.milestone_list.milestones')}</p>
              <p className="text-lg font-bold text-blue-900">{milestones.length}</p>
              <p className="text-xs text-gray-500">
                {stats.paid_count} {t('status.paid')}, {stats.pending_count} {t('status.pending')}
              </p>
            </div>
            <div className="bg-teal-50 p-3 rounded-lg">
              <p className="text-xs text-teal-600">{t('common.total_paid')}</p>
              <p className="text-lg font-bold text-teal-900">€{stats.total_paid.toLocaleString('hr-HR')}</p>
              <p className="text-xs text-gray-500">
                {contractCost > 0 ? ((stats.total_paid / contractCost) * 100).toFixed(1) : 0}% {t('supervision.site_management.milestone_list.of_contract')}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {milestones.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={t('supervision.site_management.milestone_list.none_title')}
            description={t('supervision.site_management.milestone_list.none_desc')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('supervision.site_management.milestone_list.col_name')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('common.description')}</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">{t('supervision.site_management.milestone_list.col_percentage')}</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">{t('common.amount')}</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">{t('common.paid')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('supervision.site_management.milestone_list.col_due_date')}</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('common.status')}</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((milestone) => {
                  const amount = calculateAmount(milestone.percentage)
                  const paidAmount = milestone.paid_amount || 0
                  const isFullyPaid = paidAmount >= amount
                  const isPartiallyPaid = paidAmount > 0 && paidAmount < amount
                  const paymentPercentage = amount > 0 ? (paidAmount / amount) * 100 : 0

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
                      <td className="py-3 px-4 text-right">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-gray-900">
                            €{paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {isPartiallyPaid && (
                            <div className="text-xs text-gray-500">
                              {paymentPercentage.toFixed(1)}% {t('status.paid')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-600">
                          {milestone.due_date ? format(new Date(milestone.due_date), 'MMM dd, yyyy') : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={
                          isFullyPaid ? 'green' :
                          isPartiallyPaid ? 'yellow' :
                          milestone.status === 'completed' ? 'blue' :
                          'gray'
                        } size="sm">
                          {isFullyPaid ? t('status.paid') : isPartiallyPaid ? t('status.partial') : milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
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
                  <td colSpan={3} className="py-3 px-4 text-sm text-gray-900">{t('common.total')}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900">
                    {stats?.total_percentage.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900">
                    €{stats?.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900">
                    €{stats?.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        show={!!pendingDeleteMilestoneId}
        title={t('common.confirm_delete')}
        message={t('supervision.site_management.milestone_list.delete_confirm')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteMilestone}
        onCancel={() => setPendingDeleteMilestoneId(null)}
        loading={deletingMilestone}
      />

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
