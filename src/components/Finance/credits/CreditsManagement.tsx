import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { CreditCard, Building2, ChevronDown, ChevronUp, TrendingUp, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader, LoadingSpinner, StatGrid, Modal, FormField, Input, Select, Textarea, Button, Badge, EmptyState } from '../../ui'

interface BankCredit {
  id: string
  bank_id: string
  project_id: string | null
  company_id: string | null
  credit_name: string
  credit_type: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string
  usage_expiration_date: string | null
  status: string
  purpose: string
  bank?: {
    id: string
    name: string
  }
  project?: {
    id: string
    name: string
  }
  company?: {
    id: string
    name: string
  }
}

interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  created_at: string
  project?: {
    id: string
    name: string
  }
}

interface Project {
  id: string
  name: string
}

const CreditsManagement: React.FC = () => {
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [allocations, setAllocations] = useState<Map<string, CreditAllocation[]>>(new Map())
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set())
  const [expandedAllocations, setExpandedAllocations] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [selectedCredit, setSelectedCredit] = useState<BankCredit | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  const [allocationForm, setAllocationForm] = useState({
    project_id: '',
    allocated_amount: 0,
    description: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchCredits(), fetchProjects()])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCredits = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_credits')
        .select(`
          *,
          bank:banks(id, name),
          project:projects(id, name),
          company:accounting_companies(id, name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setCredits(data || [])

      if (data) {
        for (const credit of data) {
          await fetchAllocationsForCredit(credit.id)
        }
      }
    } catch (error) {
      console.error('Error fetching credits:', error)
    }
  }

  const fetchAllocationsForCredit = async (creditId: string) => {
    try {
      const { data, error } = await supabase
        .from('credit_allocations')
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq('credit_id', creditId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setAllocations(prev => {
        const next = new Map(prev)
        next.set(creditId, data || [])
        return next
      })
    } catch (error) {
      console.error('Error fetching allocations:', error)
    }
  }

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error

      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const toggleCredit = (creditId: string) => {
    setExpandedCredits(prev => {
      const next = new Set(prev)
      if (next.has(creditId)) {
        next.delete(creditId)
      } else {
        next.add(creditId)
      }
      return next
    })
  }

  const toggleAllocation = (allocationKey: string) => {
    setExpandedAllocations(prev => {
      const next = new Set(prev)
      if (next.has(allocationKey)) {
        next.delete(allocationKey)
      } else {
        next.add(allocationKey)
      }
      return next
    })
  }

  const openAllocationModal = (credit: BankCredit) => {
    setSelectedCredit(credit)
    setAllocationForm({
      project_id: '',
      allocated_amount: 0,
      description: ''
    })
    setShowAllocationModal(true)
  }

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCredit) return

    try {
      const { error } = await supabase
        .from('credit_allocations')
        .insert({
          credit_id: selectedCredit.id,
          project_id: allocationForm.project_id || null,
          allocated_amount: allocationForm.allocated_amount,
          description: allocationForm.description
        })

      if (error) throw error

      await fetchAllocationsForCredit(selectedCredit.id)
      setShowAllocationModal(false)
    } catch (error) {
      console.error('Error creating allocation:', error)
      alert('Error creating allocation')
    }
  }

  const handleDeleteAllocation = async (allocationId: string, creditId: string) => {
    if (!confirm('Are you sure you want to delete this allocation?')) return

    try {
      const { error } = await supabase
        .from('credit_allocations')
        .delete()
        .eq('id', allocationId)

      if (error) throw error

      await fetchAllocationsForCredit(creditId)
      alert('Allocation deleted successfully')
    } catch (error) {
      console.error('Error deleting allocation:', error)
      alert('Error deleting allocation')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading credits..." />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Krediti"
        description="Pregled svih bankovnih kredita i njihovih namjena"
      />

      {credits.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nema evidentiranih kredita"
          description="Dodajte prvi kredit putem upravljanja bankama"
        />
      ) : (
        <div className="space-y-4">
          {credits.map((credit) => {
            const isExpanded = expandedCredits.has(credit.id)
            const creditAllocations = allocations.get(credit.id) || []
            const totalAllocated = creditAllocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
            const availableAmount = credit.amount - credit.used_amount
            const unallocatedAmount = credit.amount - totalAllocated
            const utilizationPercentage = credit.amount > 0 ? (credit.used_amount / credit.amount) * 100 : 0
            const allocationPercentage = credit.amount > 0 ? (totalAllocated / credit.amount) * 100 : 0
            const netUsed = credit.used_amount - credit.repaid_amount

            return (
              <div key={credit.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => toggleCredit(credit.id)}
                        className="p-3 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                        title={isExpanded ? "Collapse credit" : "Expand credit"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-6 h-6 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-6 h-6 text-blue-600" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {credit.credit_name || 'Unnamed Credit'}
                          </h3>
                          <Badge variant={
                            credit.status.toLowerCase() === 'active' ? 'green' :
                            credit.status.toLowerCase() === 'pending' ? 'yellow' :
                            credit.status.toLowerCase() === 'closed' ? 'gray' : 'blue'
                          }>
                            {credit.status}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mt-1">
                          {credit.bank?.name || 'Unknown Bank'}
                          {credit.company && ` • ${credit.company.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                        <p className="text-sm text-gray-600">Credit Amount</p>
                      </div>
                      <Button variant="success" icon={Plus} onClick={() => openAllocationModal(credit)}>
                        Namjena kredita
                      </Button>
                    </div>
                  </div>

                  <StatGrid columns={5} className="mt-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-700">Credit Amount</p>
                      <p className="text-lg font-bold text-blue-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-sm text-purple-700">Allocated</p>
                      <p className="text-lg font-bold text-purple-900">€{totalAllocated.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-sm text-orange-700">Paid Out</p>
                      <p className="text-lg font-bold text-orange-900">€{credit.used_amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${netUsed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${netUsed > 0 ? 'text-red-700' : 'text-gray-700'}`}>Used (Net)</p>
                      <p className={`text-lg font-bold ${netUsed > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                        €{netUsed.toLocaleString('hr-HR')}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${unallocatedAmount < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className={`text-sm ${unallocatedAmount < 0 ? 'text-red-700' : 'text-green-700'}`}>Unallocated</p>
                      <p className={`text-lg font-bold ${unallocatedAmount < 0 ? 'text-red-900' : 'text-green-900'}`}>
                        €{unallocatedAmount.toLocaleString('hr-HR')}
                      </p>
                    </div>
                  </StatGrid>

                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Allocation Progress</span>
                      <span className="text-sm font-medium">{allocationPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          allocationPercentage > 100 ? 'bg-red-600' :
                          allocationPercentage > 80 ? 'bg-orange-600' :
                          'bg-purple-600'
                        }`}
                        style={{ width: `${Math.min(100, allocationPercentage)}%` }}
                      ></div>
                    </div>
                    {allocationPercentage > 100 && (
                      <p className="text-xs text-red-600 mt-1">
                        Over-allocated by €{(totalAllocated - credit.amount).toLocaleString('hr-HR')}
                      </p>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <Building2 className="w-5 h-5 mr-2" />
                          Credit Details
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Credit Type:</span>
                            <span className="font-medium text-gray-900">{credit.credit_type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Interest Rate:</span>
                            <span className="font-medium text-gray-900">{credit.interest_rate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Outstanding Balance:</span>
                            <span className="font-medium text-gray-900">€{credit.outstanding_balance.toLocaleString('hr-HR')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Repaid Amount:</span>
                            <span className="font-medium text-green-600">€{credit.repaid_amount.toLocaleString('hr-HR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2" />
                          Dates & Timeline
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Start Date:</span>
                            <span className="font-medium text-gray-900">
                              {format(new Date(credit.start_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Maturity Date:</span>
                            <span className="font-medium text-gray-900">
                              {format(new Date(credit.maturity_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          {credit.usage_expiration_date && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Usage Expiration:</span>
                              <span className="font-medium text-gray-900">
                                {format(new Date(credit.usage_expiration_date), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {creditAllocations.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-4">Namjene kredita ({creditAllocations.length})</h4>
                        <div className="space-y-3">
                          {creditAllocations.map((allocation) => {
                            const allocationKey = `${credit.id}-${allocation.id}`
                            const isAllocExpanded = expandedAllocations.has(allocationKey)

                            return (
                              <div key={allocation.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => toggleAllocation(allocationKey)}
                                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between"
                                >
                                  <div className="flex items-center space-x-3">
                                    {isAllocExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-gray-600" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-600" />
                                    )}
                                    <span className="font-semibold text-gray-900">
                                      {allocation.project?.name || 'OPEX (Bez projekta)'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <div className="text-right">
                                      <div className="text-sm text-gray-600">
                                        Alocirano: <span className="font-semibold text-purple-600">€{allocation.allocated_amount.toLocaleString('hr-HR')}</span>
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Iskorišteno: €{allocation.used_amount.toLocaleString('hr-HR')} |
                                        Dostupno: <span className={allocation.allocated_amount - allocation.used_amount < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                          €{(allocation.allocated_amount - allocation.used_amount).toLocaleString('hr-HR')}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteAllocation(allocation.id, credit.id)
                                      }}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </button>
                                {isAllocExpanded && (
                                  <div className="px-4 py-3 bg-white border-t border-gray-200">
                                    {allocation.description && (
                                      <p className="text-sm text-gray-600 mb-3">{allocation.description}</p>
                                    )}
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                      <div>
                                        <p className="text-gray-600">Alocirano</p>
                                        <p className="font-semibold text-purple-600">€{allocation.allocated_amount.toLocaleString('hr-HR')}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-600">Iskorišteno</p>
                                        <p className="font-semibold text-orange-600">€{allocation.used_amount.toLocaleString('hr-HR')}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-600">Dostupno</p>
                                        <p className={`font-semibold ${allocation.allocated_amount - allocation.used_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          €{(allocation.allocated_amount - allocation.used_amount).toLocaleString('hr-HR')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {credit.purpose && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-2">Purpose</h4>
                        <p className="text-sm text-gray-600">{credit.purpose}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal show={showAllocationModal && !!selectedCredit} onClose={() => setShowAllocationModal(false)} size="sm">
        <Modal.Header title="Nova namjena kredita" onClose={() => setShowAllocationModal(false)} />

        <form onSubmit={handleCreateAllocation}>
          <Modal.Body>
            {selectedCredit && (
              <div>
                <p className="text-sm font-medium text-gray-700">Credit: {selectedCredit.credit_name}</p>
                <p className="text-sm text-gray-500">
                  Unallocated: {(selectedCredit.amount - (allocations.get(selectedCredit.id) || []).reduce((sum, a) => sum + a.allocated_amount, 0)).toLocaleString('hr-HR')}
                </p>
              </div>
            )}

            <FormField label="Project" helperText="Ostavi prazno za OPEX">
              <Select
                value={allocationForm.project_id}
                onChange={(e) => setAllocationForm({ ...allocationForm, project_id: e.target.value })}
              >
                <option value="">OPEX (Bez projekta)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Allocated Amount" required>
              <Input
                type="number"
                value={allocationForm.allocated_amount}
                onChange={(e) => setAllocationForm({ ...allocationForm, allocated_amount: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                value={allocationForm.description}
                onChange={(e) => setAllocationForm({ ...allocationForm, description: e.target.value })}
                rows={3}
              />
            </FormField>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setShowAllocationModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Create Allocation</Button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  )
}

export default CreditsManagement
