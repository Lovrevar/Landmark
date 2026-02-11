import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Briefcase, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react'
import { LoadingSpinner, PageHeader, Card, Modal, EmptyState, StatCard, Badge, SearchInput, Button, Input, FormField, ConfirmDialog } from '../ui'
import { format, differenceInDays } from 'date-fns'

interface Subcontractor {
  id: string
  name: string
  contact: string
  notes?: string
}

interface SubcontractorContract {
  id: string
  project_name: string
  phase_name: string | null
  job_description: string
  cost: number
  budget_realized: number
  progress: number
  deadline: string
  created_at: string
  has_contract: boolean
}

interface SubcontractorSummary {
  id: string
  name: string
  contact: string
  notes?: string
  total_contracts: number
  total_contract_value: number
  total_paid: number
  total_remaining: number
  active_contracts: number
  completed_contracts: number
  contracts: SubcontractorContract[]
}

const SubcontractorManagement: React.FC = () => {
  const [subcontractors, setSubcontractors] = useState<Map<string, SubcontractorSummary>>(new Map())
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<SubcontractorSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({
    show: false,
    id: '',
    name: ''
  })
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedSubcontractor) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [selectedSubcontractor])

  const handleOpenAddModal = () => {
    setEditingSubcontractor(null)
    setFormData({ name: '', contact: '', notes: '' })
    setShowFormModal(true)
  }

  const handleOpenEditModal = (sub: SubcontractorSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSubcontractor({ id: sub.id, name: sub.name, contact: sub.contact, notes: sub.notes })
    setFormData({ name: sub.name, contact: sub.contact, notes: sub.notes || '' })
    setShowFormModal(true)
  }

  const handleSaveSubcontractor = async () => {
    if (!formData.name.trim() || !formData.contact.trim()) {
      alert('Please fill in name and contact')
      return
    }

    try {
      if (editingSubcontractor) {
        const { error } = await supabase
          .from('subcontractors')
          .update({
            name: formData.name.trim(),
            contact: formData.contact.trim(),
            notes: formData.notes.trim() || null
          })
          .eq('id', editingSubcontractor.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('subcontractors')
          .insert({
            name: formData.name.trim(),
            contact: formData.contact.trim(),
            notes: formData.notes.trim() || null
          })

        if (error) throw error
      }

      setShowFormModal(false)
      fetchData()
    } catch (error) {
      console.error('Error saving subcontractor:', error)
      alert('Failed to save subcontractor')
    }
  }

  const handleDeleteConfirm = (sub: SubcontractorSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirm({ show: true, id: sub.id, name: sub.name })
  }

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .eq('id', deleteConfirm.id)

      if (error) throw error

      setDeleteConfirm({ show: false, id: '', name: '' })
      fetchData()
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
      alert('Failed to delete subcontractor. Check if there are contracts associated with it.')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('name')

      if (subError) throw subError

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select(`
          *,
          phase:project_phases!contracts_phase_id_fkey(
            phase_name,
            project:projects!project_phases_project_id_fkey(name)
          )
        `)
        .order('created_at', { ascending: false })

      if (contractsError) throw contractsError

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select('supplier_id, contract_id, base_amount, paid_amount, remaining_amount')
        .eq('invoice_category', 'SUBCONTRACTOR')

      if (invoicesError) throw invoicesError

      const grouped = new Map<string, SubcontractorSummary>()

      subcontractorsData?.forEach((sub: any) => {
        const key = sub.id
        const subContracts = contractsData?.filter(c => c.subcontractor_id === sub.id) || []

        const contracts: SubcontractorContract[] = subContracts.map((contractData: any) => {
          const phase = contractData.phase
          const cost = parseFloat(contractData.contract_amount || 0)
          const hasContract = contractData.has_contract !== false

          const contractInvoices = invoicesData?.filter(inv => inv.contract_id === contractData.id) || []
          const budgetRealized = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)
          const progress = cost > 0 ? (budgetRealized / cost) * 100 : 0

          return {
            id: contractData.id,
            project_name: phase?.project?.name || 'Unknown Project',
            phase_name: phase?.phase_name || null,
            job_description: contractData.job_description || '',
            cost,
            budget_realized: budgetRealized,
            progress: Math.min(100, progress),
            deadline: contractData.end_date || '',
            created_at: contractData.created_at,
            has_contract: hasContract
          }
        })

        const allContractIds = subContracts.map(c => c.id)
        const allInvoicesForSub = invoicesData?.filter(inv => allContractIds.includes(inv.contract_id)) || []
        const invoicesWithoutContract = invoicesData?.filter(inv => inv.supplier_id === sub.id && !inv.contract_id) || []

        let totalPaid = 0
        let totalRemaining = 0
        let totalValue = 0

        subContracts.forEach((contractData: any) => {
          const contractInvoices = allInvoicesForSub.filter(inv => inv.contract_id === contractData.id)

          if (contractInvoices.length > 0) {
            totalValue += contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.base_amount || 0), 0)
            totalPaid += contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)
            totalRemaining += contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0)
          } else if (contractData.has_contract && parseFloat(contractData.contract_amount || 0) > 0) {
            const contractAmount = parseFloat(contractData.contract_amount || 0)
            const budgetRealized = parseFloat(contractData.budget_realized || 0)
            totalValue += contractAmount
            totalPaid += budgetRealized
            totalRemaining += (contractAmount - budgetRealized)
          }
        })

        invoicesWithoutContract.forEach((invoice: any) => {
          totalValue += parseFloat(invoice.base_amount || 0)
          totalPaid += parseFloat(invoice.paid_amount || 0)
          totalRemaining += parseFloat(invoice.remaining_amount || 0)
        })

        const activeContracts = contracts.filter(c => c.progress < 100 && contractsData?.find(cd => cd.id === c.id)?.status === 'active').length
        const completedContracts = contracts.filter(c => c.progress >= 100 || contractsData?.find(cd => cd.id === c.id)?.status === 'completed').length

        grouped.set(key, {
          id: sub.id,
          name: sub.name,
          contact: sub.contact,
          notes: sub.notes,
          total_contracts: contracts.length,
          total_contract_value: totalValue,
          total_paid: totalPaid,
          total_remaining: totalRemaining,
          active_contracts: activeContracts,
          completed_contracts: completedContracts,
          contracts
        })
      })

      setSubcontractors(grouped)
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading subcontractors..." />
  }

  const subcontractorsList = Array.from(subcontractors.values())

  const filteredSubcontractors = subcontractorsList.filter(sub =>
    (sub.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sub.contact || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const displayCount = searchTerm
    ? `${filteredSubcontractors.length} / ${subcontractorsList.length}`
    : subcontractorsList.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subcontractors"
        description="Overview of all subcontractors and their contracts"
        actions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Showing' : 'Total'} Subcontractors
              </p>
              <p className="text-2xl font-bold text-gray-900">{displayCount}</p>
            </div>
            <Button onClick={handleOpenAddModal} icon={Plus}>
              Add Subcontractor
            </Button>
          </div>
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Search by subcontractor name or contact..."
        />
      </div>

      {subcontractorsList.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState
            icon={Users}
            title="No Subcontractors Yet"
            description="Add subcontractors from Site Management"
          />
        </Card>
      ) : filteredSubcontractors.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState
            icon={Users}
            title="No Matching Subcontractors"
            description="Try adjusting your search criteria"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSubcontractors.map((sub) => {
            const paymentPercentage = sub.total_contract_value > 0
              ? (sub.total_paid / sub.total_contract_value) * 100
              : 0

            return (
              <Card
                key={sub.id}
                variant="default"
                padding="lg"
                onClick={() => setSelectedSubcontractor(sub)}
              >
                <Card.Header>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{sub.name}</h3>
                    <p className="text-sm text-gray-600">{sub.contact}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleOpenEditModal(sub, e)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Subcontractor"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConfirm(sub, e)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Subcontractor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className={`p-2 rounded-lg ${
                      sub.active_contracts > 0 ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Briefcase className={`w-5 h-5 ${
                        sub.active_contracts > 0 ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                    </div>
                  </div>
                </Card.Header>

                <Card.Body>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Contracts:</span>
                      <span className="font-medium text-gray-900">{sub.total_contracts}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Active / Completed:</span>
                      <span className="font-medium text-gray-900">
                        {sub.active_contracts} / {sub.completed_contracts}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Total Value:</span>
                      <span className="font-bold text-gray-900">€{sub.total_contract_value.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Paid:</span>
                      <span className="font-medium text-teal-600">€{sub.total_paid.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-medium text-orange-600">€{sub.total_remaining.toLocaleString('hr-HR')}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-600">Payment Progress</span>
                      <span className="text-xs font-medium text-gray-900">{paymentPercentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, paymentPercentage)}%` }}
                      />
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )
          })}
        </div>
      )}

      <Modal show={showFormModal} onClose={() => setShowFormModal(false)}>
        <Modal.Header
          title={editingSubcontractor ? 'Edit Subcontractor' : 'Add Subcontractor'}
          onClose={() => setShowFormModal(false)}
        />
        <Modal.Body>
          <div className="space-y-4">
            <FormField label="Name" required>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter subcontractor name"
                autoFocus
              />
            </FormField>
            <FormField label="Contact" required>
              <Input
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="Phone number or email"
              />
            </FormField>
            <FormField label="Notes">
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </FormField>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => setShowFormModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveSubcontractor}>
            {editingSubcontractor ? 'Update' : 'Add'} Subcontractor
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!selectedSubcontractor} onClose={() => setSelectedSubcontractor(null)} size="xl">
        {selectedSubcontractor && (
          <>
            <Modal.Header
              title={selectedSubcontractor.name}
              subtitle={selectedSubcontractor.contact}
              onClose={() => setSelectedSubcontractor(null)}
            />

            <Modal.Body>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="Total Contracts"
                  value={selectedSubcontractor.total_contracts}
                  color="blue"
                />
                <StatCard
                  label="Contract Value"
                  value={`€${selectedSubcontractor.total_contract_value.toLocaleString('hr-HR')}`}
                  color="gray"
                />
                <StatCard
                  label="Total Paid"
                  value={`€${selectedSubcontractor.total_paid.toLocaleString('hr-HR')}`}
                  color="teal"
                />
                <StatCard
                  label="Remaining"
                  value={`€${selectedSubcontractor.total_remaining.toLocaleString('hr-HR')}`}
                  color="yellow"
                />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Contracts</h3>
              <div className="space-y-4">
                {selectedSubcontractor.contracts.map((contract) => {
                  const isOverdue = contract.deadline ? new Date(contract.deadline) < new Date() && contract.progress < 100 : false
                  const daysUntilDeadline = contract.deadline ? differenceInDays(new Date(contract.deadline), new Date()) : 0
                  const remaining = contract.cost - contract.budget_realized
                  const hasValidContract = contract.has_contract && contract.cost > 0

                  return (
                    <Card key={contract.id} variant="bordered" padding="md">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{contract.project_name}</h4>
                            {!hasValidContract && (
                              <Badge variant="yellow" size="sm">
                                BEZ UGOVORA
                              </Badge>
                            )}
                          </div>
                          {contract.phase_name && (
                            <p className="text-sm text-gray-600">{contract.phase_name}</p>
                          )}
                          <p className="text-sm text-gray-600 mt-1">{contract.job_description}</p>
                        </div>
                        {hasValidContract && (
                          <Badge
                            variant={
                              contract.progress >= 100 ? 'green' :
                              contract.progress > 0 ? 'blue' :
                              'gray'
                            }
                          >
                            {contract.progress}% Complete
                          </Badge>
                        )}
                      </div>

                      {hasValidContract ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-gray-600">Contract:</p>
                            <p className="font-medium text-gray-900">€{contract.cost.toLocaleString('hr-HR')}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Paid:</p>
                            <p className="font-medium text-teal-600">€{contract.budget_realized.toLocaleString('hr-HR')}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Remaining:</p>
                            <p className="font-medium text-orange-600">€{remaining.toLocaleString('hr-HR')}</p>
                          </div>
                          {contract.deadline && (
                            <div>
                              <p className="text-gray-600">Deadline:</p>
                              <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                                {format(new Date(contract.deadline), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-gray-600">Paid:</p>
                            <p className="font-medium text-teal-600">€{contract.budget_realized.toLocaleString('hr-HR')}</p>
                          </div>
                          {contract.deadline && (
                            <div>
                              <p className="text-gray-600">Deadline:</p>
                              <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                                {format(new Date(contract.deadline), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {isOverdue && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          ⚠️ Overdue by {Math.abs(daysUntilDeadline)} days
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </Modal.Body>
          </>
        )}
      </Modal>

      <ConfirmDialog
        show={deleteConfirm.show}
        title="Delete Subcontractor"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: '', name: '' })}
      />
    </div>
  )
}

export default SubcontractorManagement
