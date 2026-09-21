import React from 'react'
import { CreditCard, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, LoadingSpinner, Modal, FormField, Input, Select, Textarea, Button, EmptyState, ErrorState, Alert, Form, ConfirmDialog } from '../../ui'
import { formatEuro } from '../../../utils/formatters'
import { CreditBadges, CreditUsageTiles, CreditDetailsGrid } from './CreditSummary'
import { calculateCreditUsage } from './utils/creditUsage'
import AllocationRow from './AllocationRow'
import CreditDisbursements from './CreditDisbursements'
import CreditRepayments from './CreditRepayments'
import CreditExpenses from './CreditExpenses'
import { useCreditManagement } from './hooks/useCreditManagement'

const CreditsManagement: React.FC = () => {
  const { t } = useTranslation()
  const [errorDismissed, setErrorDismissed] = React.useState(false)
  const {
    credits,
    allocations,
    disbursedAmounts,
    expandedCredits,
    expandedAllocations,
    loading,
    error,
    refetch,
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

  // What is still free on the credit the allocation modal is open on. Computed by the same helper
  // as the tile behind the modal, so the two cannot disagree.
  const selectedCreditAllocations = selectedCredit ? allocations.get(selectedCredit.id) || [] : []
  const modalUnallocated = selectedCredit
    ? calculateCreditUsage({
        amount: selectedCredit.amount,
        disbursedToAccount: selectedCredit.disbursed_to_account,
        totalAllocated: selectedCreditAllocations.reduce((sum, a) => sum + a.allocated_amount, 0),
        usedInAllocations: selectedCreditAllocations.reduce((sum, a) => sum + (a.used_amount || 0), 0),
        unallocatedDisbursements: disbursedAmounts.get(selectedCredit.id) || 0,
      }).unallocated
    : 0

  if (loading && credits.length === 0) {
    return <LoadingSpinner message={t('funding.investments.loading')} />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={t('funding.investments.title')}
        description={t('funding.investments.description')}
      />

      {error && credits.length > 0 && !errorDismissed && (
        <Alert variant="error" className="mb-4" onDismiss={() => setErrorDismissed(true)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('common.load_error_description')}</span>
            <Button size="sm" variant="secondary" onClick={refetch} loading={loading}>{t('common.retry')}</Button>
          </div>
        </Alert>
      )}

      {/* The hook has always returned this error; the screen used to drop it and render the
          "no credit lines yet" empty state over a failed read of the whole credit register. */}
      {error && credits.length === 0 ? (
        <ErrorState onRetry={refetch} />
      ) : credits.length === 0 ? (
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

            return (
              <div key={credit.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                          <CreditBadges credit={credit} />
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {credit.bank?.name || t('funding.investments.unknown_bank')}
                          {credit.company && ` • ${credit.company.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatEuro(credit.amount)}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('banks.index.credit.investment_amount')}</p>
                      </div>
                      {!credit.disbursed_to_account && (
                        <Button variant="success" icon={Plus} onClick={() => openAllocationModal(credit)}>
                          {t('funding.investments.investment_purpose_btn')}
                        </Button>
                      )}
                    </div>
                  </div>

                  <CreditUsageTiles
                    credit={credit}
                    totalAllocated={totalAllocated}
                    usedInAllocations={totalUsedInAllocations}
                    unallocatedDisbursements={unallocatedDisbursements}
                  />
                </div>

                {isExpanded && (
                  <div className="p-6">
                    <CreditDetailsGrid credit={credit} />

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
                {/* The same figure as the "Nealocirano" tile, from the same helper: the modal used
                    to leave direct drawdowns out, so it offered money the tile had already spent. */}
                <p className={`text-sm ${modalUnallocated < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t('funding.investments.allocation_modal.unallocated_label')} {formatEuro(modalUnallocated)}
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

            <FormField label={t('funding.investments.allocation_modal.allocated_amount_label')} required error={fieldErrors.allocated_amount}>
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
