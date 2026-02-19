import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { CreditCard, Building2, ChevronDown, ChevronUp, TrendingUp, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader, LoadingSpinner, StatGrid, Modal, FormField, Input, Select, Textarea, Button, Badge, EmptyState } from '../../ui'
import AllocationRow from './AllocationRow'
import CreditDisbursements from './CreditDisbursements'

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
  disbursed_to_account?: boolean
  disbursed_to_bank_account_id?: string
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
  allocation_type: 'project' | 'opex' | 'refinancing'
  refinancing_entity_type?: 'company' | 'bank' | null
  refinancing_entity_id?: string | null
  project?: {
    id: string
    name: string
  }
  refinancing_company?: {
    id: string
    name: string
  }
  refinancing_bank?: {
    id: string
    name: string
  }
}

interface Project {
  id: string
  name: string
}

interface Company {
  id: string
  name: string
}

interface Bank {
  id: string
  name: string
}

const CreditsManagement: React.FC = () => {
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [allocations, setAllocations] = useState<Map<string, CreditAllocation[]>>(new Map())
  const [disbursedAmounts, setDisbursedAmounts] = useState<Map<string, number>>(new Map())
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set())
  const [expandedAllocations, setExpandedAllocations] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [selectedCredit, setSelectedCredit] = useState<BankCredit | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [banks, setBanks] = useState<Bank[]>([])

  const [allocationForm, setAllocationForm] = useState({
    allocation_type: 'project' as 'project' | 'opex' | 'refinancing',
    project_id: '',
    refinancing_entity_type: 'company' as 'company' | 'bank',
    refinancing_entity_id: '',
    allocated_amount: 0,
    description: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchCredits(), fetchProjects(), fetchCompanies(), fetchBanks()])
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
        const creditIds = data.map((c) => c.id)
        await fetchDisbursedAmounts(creditIds)
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

      const enrichedData = await Promise.all((data || []).map(async (allocation) => {
        if (allocation.allocation_type === 'refinancing' && allocation.refinancing_entity_id) {
          if (allocation.refinancing_entity_type === 'company') {
            const { data: company } = await supabase
              .from('accounting_companies')
              .select('id, name')
              .eq('id', allocation.refinancing_entity_id)
              .maybeSingle()

            return { ...allocation, refinancing_company: company }
          } else if (allocation.refinancing_entity_type === 'bank') {
            const { data: bank } = await supabase
              .from('banks')
              .select('id, name')
              .eq('id', allocation.refinancing_entity_id)
              .maybeSingle()

            return { ...allocation, refinancing_bank: bank }
          }
        }
        return allocation
      }))

      setAllocations(prev => {
        const next = new Map(prev)
        next.set(creditId, enrichedData)
        return next
      })
    } catch (error) {
      console.error('Error fetching allocations:', error)
    }
  }

  const fetchDisbursedAmounts = async (creditIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('accounting_invoices')
        .select('bank_credit_id, total_amount')
        .eq('invoice_type', 'OUTGOING_BANK')
        .in('bank_credit_id', creditIds)

      if (error) throw error

      const map = new Map<string, number>()
      for (const row of data || []) {
        if (!row.bank_credit_id) continue
        map.set(row.bank_credit_id, (map.get(row.bank_credit_id) || 0) + Number(row.total_amount))
      }
      setDisbursedAmounts(map)
    } catch (error) {
      console.error('Error fetching disbursed amounts:', error)
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

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_companies')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error

      setCompanies(data || [])
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error

      setBanks(data || [])
    } catch (error) {
      console.error('Error fetching banks:', error)
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
      allocation_type: 'project',
      project_id: '',
      refinancing_entity_type: 'company',
      refinancing_entity_id: '',
      allocated_amount: 0,
      description: ''
    })
    setShowAllocationModal(true)
  }

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCredit) return

    try {
      const payload: any = {
        credit_id: selectedCredit.id,
        allocation_type: allocationForm.allocation_type,
        allocated_amount: allocationForm.allocated_amount,
        description: allocationForm.description,
        project_id: null,
        refinancing_entity_type: null,
        refinancing_entity_id: null
      }

      if (allocationForm.allocation_type === 'project') {
        payload.project_id = allocationForm.project_id || null
      } else if (allocationForm.allocation_type === 'refinancing') {
        payload.refinancing_entity_type = allocationForm.refinancing_entity_type
        payload.refinancing_entity_id = allocationForm.refinancing_entity_id
      }

      const { error } = await supabase
        .from('credit_allocations')
        .insert(payload)

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
        title="Investicije"
        description="Pregled svih investicija i njihovih namjena"
      />

      {credits.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nema evidentiranih investicija"
          description="Dodajte prvu investiciju putem upravljanja investicijama"
        />
      ) : (
        <div className="space-y-4">
          {credits.map((credit) => {
            const isExpanded = expandedCredits.has(credit.id)
            const creditAllocations = allocations.get(credit.id) || []
            const totalAllocated = creditAllocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0)
            const paidOut = disbursedAmounts.get(credit.id) || 0
            const unallocatedAmount = credit.amount - totalAllocated - paidOut
            const allocationPercentage = credit.amount > 0 ? (totalAllocated / credit.amount) * 100 : 0
            const paidOutPercentage = credit.amount > 0 ? (paidOut / credit.amount) * 100 : 0
            const totalUsagePercentage = allocationPercentage + paidOutPercentage
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
                          {credit.credit_type === 'equity' && (
                            <Badge variant="purple">EQUITY</Badge>
                          )}
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
                        <p className="text-sm text-gray-600">Investment Amount</p>
                      </div>
                      <Button variant="success" icon={Plus} onClick={() => openAllocationModal(credit)}>
                        Namjena Investicije
                      </Button>
                    </div>
                  </div>

                  <StatGrid columns={5} className="mt-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-700">Investment Amount</p>
                      <p className="text-lg font-bold text-blue-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-violet-50 p-3 rounded-lg">
                      <p className="text-sm text-violet-700">Allocated</p>
                      <p className="text-lg font-bold text-violet-900">€{totalAllocated.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-sm text-orange-700">Paid Out</p>
                      <p className="text-lg font-bold text-orange-900">€{paidOut.toLocaleString('hr-HR')}</p>
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
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Credit Usage</span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-3 h-3 rounded-sm bg-violet-600"></span>
                          Allocated {allocationPercentage.toFixed(1)}%
                        </span>
                        {paidOutPercentage > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-sm bg-orange-500"></span>
                            Paid Out {paidOutPercentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{totalUsagePercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 flex overflow-hidden">
                      <div
                        className={`h-3 transition-all duration-300 ${totalUsagePercentage > 100 ? 'bg-red-600' : 'bg-violet-600'}`}
                        style={{ width: `${Math.min(100, allocationPercentage)}%` }}
                      />
                      <div
                        className={`h-3 transition-all duration-300 ${totalUsagePercentage > 100 ? 'bg-red-400' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(100 - Math.min(100, allocationPercentage), paidOutPercentage)}%` }}
                      />
                    </div>
                    {totalUsagePercentage > 100 && (
                      <p className="text-xs text-red-600 mt-1">
                        Over-allocated by €{(totalAllocated + paidOut - credit.amount).toLocaleString('hr-HR')}
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
                            <span className="text-gray-600">Loan Type:</span>
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
                            return (
                              <AllocationRow
                                key={allocation.id}
                                allocation={allocation}
                                credit={credit}
                                allocationKey={allocationKey}
                                isExpanded={expandedAllocations.has(allocationKey)}
                                onToggle={toggleAllocation}
                                onDelete={handleDeleteAllocation}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <CreditDisbursements creditId={credit.id} />

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

            <FormField label="Kategorija" required>
              <Select
                value={allocationForm.allocation_type}
                onChange={(e) => setAllocationForm({
                  ...allocationForm,
                  allocation_type: e.target.value as 'project' | 'opex' | 'refinancing',
                  project_id: '',
                  refinancing_entity_id: ''
                })}
              >
                <option value="project">Projekt</option>
                <option value="opex">OPEX (Bez projekta)</option>
                <option value="refinancing">Refinanciranje</option>
              </Select>
            </FormField>

            {allocationForm.allocation_type === 'project' && (
              <FormField label="Project" required>
                <Select
                  value={allocationForm.project_id}
                  onChange={(e) => setAllocationForm({ ...allocationForm, project_id: e.target.value })}
                  required
                >
                  <option value="">Odaberi projekt...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            {allocationForm.allocation_type === 'refinancing' && (
              <>
                <FormField label="Tip entiteta" required>
                  <Select
                    value={allocationForm.refinancing_entity_type}
                    onChange={(e) => setAllocationForm({
                      ...allocationForm,
                      refinancing_entity_type: e.target.value as 'company' | 'bank',
                      refinancing_entity_id: ''
                    })}
                  >
                    <option value="company">Firma</option>
                    <option value="bank">Banka</option>
                  </Select>
                </FormField>

                <FormField label={allocationForm.refinancing_entity_type === 'company' ? 'Firma' : 'Banka'} required>
                  <Select
                    value={allocationForm.refinancing_entity_id}
                    onChange={(e) => setAllocationForm({ ...allocationForm, refinancing_entity_id: e.target.value })}
                    required
                  >
                    <option value="">Odaberi {allocationForm.refinancing_entity_type === 'company' ? 'firmu' : 'banku'}...</option>
                    {allocationForm.refinancing_entity_type === 'company'
                      ? companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))
                      : banks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.name}
                          </option>
                        ))
                    }
                  </Select>
                </FormField>
              </>
            )}

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
