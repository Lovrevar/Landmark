import React from 'react'
import { CreditCard, Building2, ChevronDown, ChevronUp, TrendingUp, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { PageHeader, LoadingSpinner, StatGrid, Modal, FormField, Input, Select, Textarea, Button, Badge, EmptyState, Form, ConfirmDialog } from '../../ui'
import AllocationRow from './AllocationRow'
import CreditDisbursements from './CreditDisbursements'
import CreditRepayments from './CreditRepayments'
import CreditExpenses from './CreditExpenses'
import { useCreditManagement } from './hooks/useCreditManagement'

const CreditsManagement: React.FC = () => {
  const { t } = useTranslation()
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
    return <LoadingSpinner message={t('funding.investments.loading')} />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={t('funding.investments.title')}
        description={t('funding.investments.description')}
      />

      {credits.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t('funding.investments.no_investments_title')}
          description={t('funding.investments.no_investments_description')}
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
              <div key={credit.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => toggleCredit(credit.id)}
                        className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200"
                        title={isExpanded ? t('funding.investments.collapse_credit_title') : t('funding.investments.expand_credit_title')}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-6 h-6 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-6 h-6 text-blue-600" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {credit.credit_name || t('funding.investments.unnamed_credit')}
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
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {credit.bank?.name || t('funding.investments.unknown_bank')}
                          {credit.company && ` • ${credit.company.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">€{credit.amount.toLocaleString('hr-HR')}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('banks.index.credit.investment_amount')}</p>
                      </div>
                      {!credit.disbursed_to_account && (
                        <Button variant="success" icon={Plus} onClick={() => openAllocationModal(credit)}>
                          {t('funding.investments.investment_purpose_btn')}
                        </Button>
                      )}
                    </div>
                  </div>

                  <StatGrid columns={5} className="mt-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">{t('banks.index.credit.investment_amount')}</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">€{credit.amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <p className="text-sm text-slate-700 dark:text-gray-200">{t('banks.index.credit.allocated')}</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">€{totalAllocated.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                      <p className="text-sm text-orange-700 dark:text-orange-400">{t('banks.index.credit.paid_out')}</p>
                      <p className="text-lg font-bold text-orange-900 dark:text-orange-300">€{paidOut.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${netUsed > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                      <p className={`text-sm ${netUsed > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>{t('banks.index.credit.debt')}</p>
                      <p className={`text-lg font-bold ${netUsed > 0 ? 'text-red-900 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                        €{credit.outstanding_balance.toLocaleString('hr-HR')}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${unallocatedAmount < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                      <p className={`text-sm ${unallocatedAmount < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{t('banks.index.credit.unallocated')}</p>
                      <p className={`text-lg font-bold ${unallocatedAmount < 0 ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'}`}>
                        €{unallocatedAmount.toLocaleString('hr-HR')}
                      </p>
                    </div>
                  </StatGrid>

                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{t('funding.investments.investment_usage_label')}</span>
                        {usedPercentage > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-sm bg-orange-500"></span>
                            {t('funding.investments.used_percent', { percent: usedPercentage.toFixed(1) })}
                          </span>
                        )}
                        {remainingAllocatedPercentage > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-sm bg-slate-500"></span>
                            {t('funding.investments.allocated_percent', { percent: remainingAllocatedPercentage.toFixed(1) })}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{totalUsagePercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 flex overflow-hidden">
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
                        {t('funding.investments.over_allocated', { amount: (totalAllocated - credit.amount).toLocaleString('hr-HR') })}
                      </p>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
                          <Building2 className="w-5 h-5 mr-2" />
                          {t('banks.index.credit.credit_details')}
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.loan_type_label')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{credit.credit_type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.interest_rate_label')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{credit.interest_rate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.outstanding_balance_label')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">€{credit.outstanding_balance.toLocaleString('hr-HR')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.repaid_amount_label')}</span>
                            <span className="font-medium text-green-600">€{credit.repaid_amount.toLocaleString('hr-HR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2" />
                          {t('banks.index.credit.dates_timeline')}
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.start_date_label')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {format(new Date(credit.start_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.maturity_date_label')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {format(new Date(credit.maturity_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          {credit.usage_expiration_date && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.usage_expiration_label')}</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {format(new Date(credit.usage_expiration_date), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {creditAllocations.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{t('banks.index.credit.allocations_heading', { count: creditAllocations.length })}</h4>
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
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{t('banks.index.credit.purpose_heading')}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{credit.purpose}</p>
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
        <Modal.Header title={t('funding.investments.allocation_modal.title')} onClose={closeAllocationModal} />

        <Form onSubmit={handleCreateAllocation}>
          <Modal.Body>
            {selectedCredit && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('funding.investments.allocation_modal.credit_label')} {selectedCredit.credit_name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('funding.investments.allocation_modal.unallocated_label')} {(selectedCredit.amount - (allocations.get(selectedCredit.id) || []).reduce((sum, a) => sum + a.allocated_amount, 0)).toLocaleString('hr-HR')}
                </p>
              </div>
            )}

            <FormField label={t('funding.investments.allocation_modal.category_label')} required>
              <Select
                value={allocationForm.allocation_type}
                onChange={(e) => setAllocationForm({
                  ...allocationForm,
                  allocation_type: e.target.value as 'project' | 'opex' | 'refinancing',
                  project_id: '',
                  refinancing_entity_id: '',
                })}
              >
                <option value="project">{t('funding.investments.allocation_modal.project_option')}</option>
                <option value="opex">{t('funding.investments.allocation_modal.opex_option')}</option>
                <option value="refinancing">{t('funding.investments.allocation_modal.refinancing_option')}</option>
              </Select>
            </FormField>

            {allocationForm.allocation_type === 'project' && (
              <FormField label={t('funding.investments.allocation_modal.project_label')} required error={fieldErrors.project_id}>
                <Select
                  value={allocationForm.project_id}
                  onChange={(e) => setAllocationForm({ ...allocationForm, project_id: e.target.value })}
                >
                  <option value="">{t('funding.investments.allocation_modal.select_project')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
              </FormField>
            )}

            {allocationForm.allocation_type === 'refinancing' && (
              <>
                <FormField label={t('funding.investments.allocation_modal.entity_type_label')} required>
                  <Select
                    value={allocationForm.refinancing_entity_type}
                    onChange={(e) => setAllocationForm({
                      ...allocationForm,
                      refinancing_entity_type: e.target.value as 'company' | 'bank',
                      refinancing_entity_id: '',
                    })}
                  >
                    <option value="company">{t('funding.investments.allocation_modal.company_option')}</option>
                    <option value="bank">{t('funding.investments.allocation_modal.bank_option')}</option>
                  </Select>
                </FormField>

                <FormField label={allocationForm.refinancing_entity_type === 'company' ? t('funding.investments.allocation_modal.company_option') : t('funding.investments.allocation_modal.bank_option')} required error={fieldErrors.refinancing_entity_id}>
                  <Select
                    value={allocationForm.refinancing_entity_id}
                    onChange={(e) => setAllocationForm({ ...allocationForm, refinancing_entity_id: e.target.value })}
                  >
                    <option value="">{allocationForm.refinancing_entity_type === 'company' ? t('funding.investments.allocation_modal.select_company') : t('funding.investments.allocation_modal.select_bank')}</option>
                    {allocationForm.refinancing_entity_type === 'company'
                      ? companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                      : banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)
                    }
                  </Select>
                </FormField>
              </>
            )}

            <FormField label={t('funding.investments.allocation_modal.allocated_amount_label')} required>
              <Input
                type="number"
                value={allocationForm.allocated_amount}
                onChange={(e) => setAllocationForm({ ...allocationForm, allocated_amount: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
            </FormField>

            <FormField label={t('funding.investments.allocation_modal.description_label')}>
              <Textarea
                value={allocationForm.description}
                onChange={(e) => setAllocationForm({ ...allocationForm, description: e.target.value })}
                rows={3}
              />
            </FormField>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={closeAllocationModal}>{t('funding.investments.allocation_modal.cancel_button')}</Button>
            <Button variant="primary" type="submit">{t('funding.investments.allocation_modal.create_button')}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={!!pendingDeleteAllocation}
        title={t('funding.investments.confirm_delete_allocation_title')}
        message={t('funding.investments.confirm_delete_allocation_message')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteAllocation}
        onCancel={cancelDeleteAllocation}
        loading={deletingAllocation}
      />
    </div>
  )
}

export default CreditsManagement
