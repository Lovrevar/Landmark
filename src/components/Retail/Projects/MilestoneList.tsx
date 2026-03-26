import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Calendar, CheckCircle, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Button, Badge, EmptyState, LoadingSpinner, ConfirmDialog } from '../../ui'
import type { RetailContractMilestone } from '../../../types/retail'
import { MilestoneFormModal } from './forms/MilestoneFormModal'
import { retailProjectService } from './services/retailProjectService'
import { useToast } from '../../../contexts/ToastContext'

interface MilestoneStats {
  totalPercentage: number
  remainingPercentage: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  milestonesCount: number
}

interface MilestoneListProps {
  contractId: string
  supplierName: string
  projectName: string
  phaseName: string
  contractCost: number
  onClose: () => void
}

export const MilestoneList: React.FC<MilestoneListProps> = ({
  contractId,
  supplierName,
  projectName,
  phaseName,
  contractCost,
  onClose
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [milestones, setMilestones] = useState<RetailContractMilestone[]>([])
  const [stats, setStats] = useState<MilestoneStats | null>(null)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<RetailContractMilestone | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingDeleteMilestoneId, setPendingDeleteMilestoneId] = useState<string | null>(null)
  const [deletingMilestone, setDeletingMilestone] = useState(false)

  useEffect(() => {
    loadMilestones()
  }, [contractId])

  const loadMilestones = async () => {
    try {
      setLoading(true)
      const data = await retailProjectService.fetchMilestonesByContract(contractId)
      setMilestones(data)

      const statsData = await retailProjectService.getMilestoneStatsForContract(contractId, contractCost)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading milestones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMilestone = async (data: { contract_id: string; milestone_name: string; description: string; percentage: number; due_date: string | null }) => {
    try {
      const milestoneNumber = await retailProjectService.getNextMilestoneNumber(contractId)
      await retailProjectService.createMilestone({
        contract_id: data.contract_id,
        milestone_number: milestoneNumber,
        milestone_name: data.milestone_name,
        description: data.description,
        percentage: data.percentage,
        due_date: data.due_date,
        status: 'pending',
        notes: null,
        completed_date: null
      })
      setShowMilestoneModal(false)
      loadMilestones()
    } catch (error) {
      console.error('Error creating milestone:', error)
      toast.error(t('retail_projects.milestones.error_create'))
    }
  }

  const handleEditMilestone = async (data: { contract_id: string; milestone_name: string; description: string; percentage: number; due_date: string | null }) => {
    if (!editingMilestone) return

    try {
      await retailProjectService.updateMilestone(editingMilestone.id, {
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
      toast.error(t('retail_projects.milestones.error_update'))
    }
  }

  const handleDeleteMilestone = (milestoneId: string) => {
    setPendingDeleteMilestoneId(milestoneId)
  }

  const confirmDeleteMilestone = async () => {
    if (!pendingDeleteMilestoneId) return
    setDeletingMilestone(true)
    try {
      await retailProjectService.deleteMilestone(pendingDeleteMilestoneId)
      loadMilestones()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      toast.error(t('retail_projects.milestones.error_delete'))
    } finally {
      setDeletingMilestone(false)
      setPendingDeleteMilestoneId(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="bg-white rounded-xl shadow-xl">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('retail_projects.milestones.title')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {projectName} • {phaseName} • {supplierName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {t('retail_projects.milestones.contract_label', { amount: formatCurrency(contractCost) })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 mb-1">{t('retail_projects.milestones.stats.total_distributed')}</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalPercentage.toFixed(1)}%</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 mb-1">{t('retail_projects.milestones.stats.paid')}</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.paidAmount)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600 mb-1">{t('retail_projects.milestones.stats.pending')}</p>
                  <p className="text-2xl font-bold text-orange-900">{formatCurrency(stats.pendingAmount)}</p>
                </div>
                <Calendar className="w-8 h-8 text-orange-600 opacity-50" />
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              stats.remainingPercentage > 0 ? 'bg-gray-50' : 'bg-green-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs mb-1 ${
                    stats.remainingPercentage > 0 ? 'text-gray-600' : 'text-green-600'
                  }`}>
                    {t('retail_projects.milestones.stats.remaining')}
                  </p>
                  <p className={`text-2xl font-bold ${
                    stats.remainingPercentage > 0 ? 'text-gray-900' : 'text-green-900'
                  }`}>
                    {stats.remainingPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('retail_projects.milestones.list_title', { count: milestones.length })}
          </h3>
          <Button
            icon={Plus}
            onClick={() => {
              setEditingMilestone(null)
              setShowMilestoneModal(true)
            }}
          >
            {t('retail_projects.milestones.add')}
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner message={t('retail_projects.milestones.loading')} />
        ) : milestones.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={t('retail_projects.milestones.empty_title')}
            action={
              <Button
                icon={Plus}
                onClick={() => {
                  setEditingMilestone(null)
                  setShowMilestoneModal(true)
                }}
              >
                {t('retail_projects.milestones.add_first')}
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {milestones.map((milestone) => {
              const amount = (contractCost * milestone.percentage) / 100
              const isPaid = milestone.status === 'paid'
              const isPending = milestone.status === 'pending'

              return (
                <div
                  key={milestone.id}
                  className={`p-4 rounded-lg border-2 ${
                    isPaid ? 'border-green-200 bg-green-50' :
                    isPending ? 'border-blue-200 bg-blue-50' :
                    'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          #{milestone.milestone_number}
                        </span>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {milestone.milestone_name}
                        </h4>
                        <Badge variant={isPaid ? 'green' : isPending ? 'blue' : 'gray'}>
                          {isPaid ? t('retail_projects.milestones.status_paid') : isPending ? t('retail_projects.milestones.status_pending') : t('retail_projects.milestones.status_unpaid')}
                        </Badge>
                      </div>

                      {milestone.description && (
                        <p className="text-sm text-gray-600 mb-3">{milestone.description}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">{t('retail_projects.milestones.percentage')}</p>
                          <p className="text-lg font-semibold text-gray-900">{milestone.percentage}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('retail_projects.milestones.amount')}</p>
                          <p className="text-lg font-semibold text-gray-900">{formatCurrency(amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('retail_projects.milestones.paid_amount')}</p>
                          <p className="text-lg font-semibold text-teal-600">
                            {formatCurrency(milestone.amount_paid || 0)}
                          </p>
                          {amount > 0 && (
                            <div className="mt-1">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    (milestone.amount_paid || 0) >= amount
                                      ? 'bg-green-500'
                                      : (milestone.amount_paid || 0) > 0
                                      ? 'bg-teal-500'
                                      : 'bg-gray-300'
                                  }`}
                                  style={{ width: `${Math.min(100, ((milestone.amount_paid || 0) / amount) * 100)}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {Math.min(100, ((milestone.amount_paid || 0) / amount) * 100).toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>
                        {milestone.due_date && (
                          <div>
                            <p className="text-xs text-gray-500">{t('retail_projects.milestones.due_date')}</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {format(new Date(milestone.due_date), 'dd.MM.yyyy')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        icon={Edit2}
                        size="icon-md"
                        onClick={() => {
                          setEditingMilestone(milestone)
                          setShowMilestoneModal(true)
                        }}
                      />
                      <Button
                        variant="outline-danger"
                        icon={Trash2}
                        size="icon-md"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <MilestoneFormModal
        visible={showMilestoneModal}
        onClose={() => {
          setShowMilestoneModal(false)
          setEditingMilestone(null)
        }}
        onSubmit={editingMilestone ? handleEditMilestone : handleAddMilestone}
        contractId={contractId}
        supplierName={supplierName}
        projectName={projectName}
        phaseName={phaseName}
        contractCost={contractCost}
        editingMilestone={editingMilestone}
      />

      <ConfirmDialog
        show={!!pendingDeleteMilestoneId}
        title={t('retail_projects.milestones.confirm_delete_title')}
        message={t('retail_projects.milestones.confirm_delete_msg')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteMilestone}
        onCancel={() => setPendingDeleteMilestoneId(null)}
        loading={deletingMilestone}
      />
    </div>
  )
}
