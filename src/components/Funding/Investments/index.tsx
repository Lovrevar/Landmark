import React from 'react'
import { CreditCard, Building2, ChevronDown, ChevronUp, TrendingUp, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader, LoadingSpinner, StatGrid, Modal, FormField, Input, Select, Textarea, Button, Badge, EmptyState, Form, ConfirmDialog } from '../../ui'
import AllocationRow from './AllocationRow'
import CreditDisbursements from './CreditDisbursements'
import CreditRepayments from './CreditRepayments'
import CreditExpenses from './CreditExpenses'
import { useCreditManagement } from './hooks/useCreditManagement'

const CreditsManagement: React.FC = () => {
  const {
    credits,
    allocations,
    disbursedAmounts,
    expandedCredits,
    expandedAllocations,
    loading,
    projects,
    companies,
    banks,
    showAllocationModal,
    selectedCredit,
    allocationForm,
    setAllocationForm,
    toggleCredit,
    toggleAllocation,
    openAllocationModal,
    closeAllocationModal,
    handleCreateAllocation,
    handleDeleteAllocation,
    confirmDeleteAllocation,
    cancelDeleteAllocation,
    pendingDeleteAllocation,
    deletingAllocation,
    fieldErrors,
  } = useCreditManagement()

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
            const totalUsedInAllocations = creditAllocations.reduce((sum, alloc) => sum + (alloc.used_amount || 0), 0)
            const unallocatedDisbursements = disbursedAmounts.get(credit.id) || 0
            const directlyDisbursed = credit.disbursed_to_account ? credit.amount : 0
            const totalIskorišteno = credit.disbursed_to_account
              ? directlyDisbursed
              : totalUsedInAllocations + unallocatedDisbursements
            const paidOut = totalIskorišteno
            const remainingAllocated = credit.disbursed_to_account ? 0 : Math.max(0, totalAllocated - totalUsedInAllocations)
            const unallocatedAmount = credit.disbursed_to_account
              ? 0
              : Math.max(0, credit.amount - totalAllocated - unallocatedDisbursements)
            const allocationPercentage = credit.amount > 0 ? (totalAllocated / credit.amount) * 100 : 0
            const remainingAllocatedPercentage = credit.amount > 0 ? (remainingAllocated / credit.amount) * 100 : 0
            const usedPercentage = credit.amount > 0 ? (totalIskorišteno / credit.amount) * 100 : 0
            const totalUsagePercentage = usedPercentage + remainingAllocatedPercentage
            const netUsed = credit.used_amount + paidOut - credit.repaid_amount

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
                      {!credit.disbursed_to_account && (
                        <Button variant="success" icon={Plus} onClick={() => openAllocationModal(credit)}>
                          Namjena Investicije
                        </Button>
                      )}
                    </div>
                  </div>

                  <StatGrid columns={5} className="mt-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-700">Investment Amount</p>
                      <p className="text-lg font-bold text-blue-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-sm text-slate-700">Alocirano</p>
                      <p className="text-lg font-bold text-slate-900">€{totalAllocated.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-sm text-orange-700">Iskorišteno</p>
                      <p className="text-lg font-bold text-orange-900">€{paidOut.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${netUsed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${netUsed > 0 ? 'text-red-700' : 'text-gray-700'}`}>Dug</p>
                      <p className={`text-lg font-bold ${netUsed > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                        €{credit.outstanding_balance.toLocaleString('hr-HR')}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${unallocatedAmount < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className={`text-sm ${unallocatedAmount < 0 ? 'text-red-700' : 'text-green-700'}`}>Nealocirano</p>
                      <p className={`text-lg font-bold ${unallocatedAmount < 0 ? 'text-red-900' : 'text-green-900'}`}>
                        €{unallocatedAmount.toLocaleString('hr-HR')}
                      </p>
                    </div>
                  </StatGrid>

                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Korištenje investicije</span>
                        {usedPercentage > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-sm bg-orange-500"></span>
                            Iskorišteno {usedPercentage.toFixed(1)}%
                          </span>
                        )}
                        {remainingAllocatedPercentage > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-sm bg-slate-500"></span>
                            Alocirano {remainingAllocatedPercentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{totalUsagePercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 flex overflow-hidden">
                      <div
                        className="h-3 bg-orange-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, usedPercentage)}%` }}
                      />
                      <div
                        className={`h-3 transition-all duration-300 ${allocationPercentage > 100 ? 'bg-red-600' : 'bg-slate-500'}`}
                        style={{ width: `${Math.min(100 - Math.min(100, usedPercentage), remainingAllocatedPercentage)}%` }}
                      />
                    </div>
                    {allocationPercentage > 100 && (
                      <p className="text-xs text-red-600 mt-1">
                        Prekoračeno za €{(totalAllocated - credit.amount).toLocaleString('hr-HR')}
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
                    <CreditRepayments creditId={credit.id} />
                    <CreditExpenses creditId={credit.id} />

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

      <Modal show={showAllocationModal && !!selectedCredit} onClose={closeAllocationModal} size="sm">
        <Modal.Header title="Nova namjena kredita" onClose={closeAllocationModal} />

        <Form onSubmit={handleCreateAllocation}>
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
                  refinancing_entity_id: '',
                })}
              >
                <option value="project">Projekt</option>
                <option value="opex">OPEX (Bez projekta)</option>
                <option value="refinancing">Refinanciranje</option>
              </Select>
            </FormField>

            {allocationForm.allocation_type === 'project' && (
              <FormField label="Project" required error={fieldErrors.project_id}>
                <Select
                  value={allocationForm.project_id}
                  onChange={(e) => setAllocationForm({ ...allocationForm, project_id: e.target.value })}
                >
                  <option value="">Odaberi projekt...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
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
                      refinancing_entity_id: '',
                    })}
                  >
                    <option value="company">Firma</option>
                    <option value="bank">Banka</option>
                  </Select>
                </FormField>

                <FormField label={allocationForm.refinancing_entity_type === 'company' ? 'Firma' : 'Banka'} required error={fieldErrors.refinancing_entity_id}>
                  <Select
                    value={allocationForm.refinancing_entity_id}
                    onChange={(e) => setAllocationForm({ ...allocationForm, refinancing_entity_id: e.target.value })}
                  >
                    <option value="">Odaberi {allocationForm.refinancing_entity_type === 'company' ? 'firmu' : 'banku'}...</option>
                    {allocationForm.refinancing_entity_type === 'company'
                      ? companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                      : banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)
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
            <Button variant="secondary" type="button" onClick={closeAllocationModal}>Cancel</Button>
            <Button variant="primary" type="submit">Create Allocation</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={!!pendingDeleteAllocation}
        title="Potvrda brisanja"
        message="Jeste li sigurni da želite obrisati ovu namjenu?"
        confirmLabel="Da, obriši"
        cancelLabel="Odustani"
        variant="danger"
        onConfirm={confirmDeleteAllocation}
        onCancel={cancelDeleteAllocation}
        loading={deletingAllocation}
      />
    </div>
  )
}

export default CreditsManagement
