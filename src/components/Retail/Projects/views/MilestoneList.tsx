import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Calendar, CheckCircle, DollarSign, X } from 'lucide-react'
import { format } from 'date-fns'
import type { RetailContractMilestone } from '../../../../types/retail'
import { MilestoneFormModal } from '../forms/MilestoneFormModal'
import { retailProjectService } from '../services/retailProjectService'

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
  const [milestones, setMilestones] = useState<RetailContractMilestone[]>([])
  const [stats, setStats] = useState<MilestoneStats | null>(null)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<RetailContractMilestone | null>(null)
  const [loading, setLoading] = useState(true)

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

  const handleAddMilestone = async (data: any) => {
    try {
      const milestoneNumber = await retailProjectService.getNextMilestoneNumber(contractId)
      await retailProjectService.createMilestone({
        ...data,
        milestone_number: milestoneNumber
      })
      setShowMilestoneModal(false)
      loadMilestones()
    } catch (error) {
      console.error('Error creating milestone:', error)
      alert('Greška pri kreiranju milestonea')
    }
  }

  const handleEditMilestone = async (data: any) => {
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
      alert('Greška pri ažuriranju milestonea')
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovaj milestone?')) return

    try {
      await retailProjectService.deleteMilestone(milestoneId)
      loadMilestones()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      alert('Greška pri brisanju milestonea')
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
            <h2 className="text-2xl font-bold text-gray-900">Milestones plaćanja</h2>
            <p className="text-sm text-gray-600 mt-1">
              {projectName} • {phaseName} • {supplierName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Ugovor: {formatCurrency(contractCost)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 mb-1">Ukupno podijeljeno</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalPercentage.toFixed(1)}%</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 mb-1">Plaćeno</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.paidAmount)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600 mb-1">U čekanju</p>
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
                    Preostalo
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
            Milestones ({milestones.length})
          </h3>
          <button
            onClick={() => {
              setEditingMilestone(null)
              setShowMilestoneModal(true)
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj milestone
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Učitavam milestones...</p>
          </div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Nema milestoneova za ovaj ugovor</p>
            <button
              onClick={() => {
                setEditingMilestone(null)
                setShowMilestoneModal(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Dodaj prvi milestone
            </button>
          </div>
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
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          isPaid ? 'bg-green-100 text-green-800' :
                          isPending ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isPaid ? 'Plaćeno' : isPending ? 'U čekanju' : 'Nije plaćeno'}
                        </span>
                      </div>

                      {milestone.description && (
                        <p className="text-sm text-gray-600 mb-3">{milestone.description}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Postotak</p>
                          <p className="text-lg font-semibold text-gray-900">{milestone.percentage}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Iznos</p>
                          <p className="text-lg font-semibold text-gray-900">{formatCurrency(amount)}</p>
                        </div>
                        {milestone.due_date && (
                          <div>
                            <p className="text-xs text-gray-500">Dospijeće</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {format(new Date(milestone.due_date), 'dd.MM.yyyy')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setEditingMilestone(milestone)
                          setShowMilestoneModal(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Uredi"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMilestone(milestone.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Obriši"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
    </div>
  )
}
