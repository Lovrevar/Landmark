import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Building2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import DateInput from '../../Common/DateInput'
import { useLoans } from './hooks/useLoans'
import { PageHeader, LoadingSpinner, SearchInput, Button, Modal, FormField, Select, Input, Form, ConfirmDialog } from '../../ui'

const AccountingLoans: React.FC = () => {
  const { t } = useTranslation()
  const {
    companies,
    loading,
    searchTerm,
    setSearchTerm,
    showAddModal,
    setShowAddModal,
    formData,
    setFormData,
    fieldErrors,
    handleAddLoan,
    handleDeleteLoan,
    confirmDeleteLoan,
    cancelDeleteLoan,
    pendingDeleteId,
    deleting,
    resetForm,
    getFromCompanyAccounts,
    getToCompanyAccounts,
    filteredLoans
  } = useLoans()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('loans.title')}
        description={t('loans.description')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
            {t('loans.add_button')}
          </Button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder={t('loans.search_placeholder')}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('loans.table.date')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('loans.table.from')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('loans.table.from_account')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('loans.table.to')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('loans.table.to_account')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('loans.table.amount')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {t('loans.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {t('loans.empty')}
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(loan.loan_date), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {loan.from_company.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        <div className="font-medium">{loan.from_bank_account.bank_name}</div>
                        {loan.from_bank_account.account_number && (
                          <div className="text-xs text-gray-500">{loan.from_bank_account.account_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {loan.to_company.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        <div className="font-medium">{loan.to_bank_account.bank_name}</div>
                        {loan.to_bank_account.account_number && (
                          <div className="text-xs text-gray-500">{loan.to_bank_account.account_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        €{loan.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <Button variant="outline-danger" size="icon-sm" icon={Trash2} onClick={() => handleDeleteLoan(loan.id)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal show={showAddModal} onClose={() => { setShowAddModal(false); resetForm() }} size="md">
        <Modal.Header title={t('loans.modal_title')} onClose={() => { setShowAddModal(false); resetForm() }} />
        <Form onSubmit={handleAddLoan}>
          <Modal.Body>
            <FormField label={t('loans.form.from_label')} required error={fieldErrors.from_company_id}>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Select
                  value={formData.from_company_id}
                  onChange={(e) => setFormData({ ...formData, from_company_id: e.target.value, from_bank_account_id: '' })}
                  className="pl-10"
                >
                  <option value="">{t('loans.form.select_company')}</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              </div>
            </FormField>

            {formData.from_company_id && (
              <FormField label={t('loans.form.from_account_label')} required error={fieldErrors.from_bank_account_id}>
                <Select
                  value={formData.from_bank_account_id}
                  onChange={(e) => setFormData({ ...formData, from_bank_account_id: e.target.value })}
                >
                  <option value="">{t('loans.form.select_account')}</option>
                  {getFromCompanyAccounts().map(account => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} ({t('loans.form.balance_label')}{account.current_balance.toLocaleString('hr-HR', { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            <div className="border-t border-gray-200 pt-4"></div>

            <FormField label={t('loans.form.to_label')} required error={fieldErrors.to_company_id}>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Select
                  value={formData.to_company_id}
                  onChange={(e) => setFormData({ ...formData, to_company_id: e.target.value, to_bank_account_id: '' })}
                  className="pl-10"
                >
                  <option value="">{t('loans.form.select_company')}</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              </div>
            </FormField>

            {formData.to_company_id && (
              <FormField label={t('loans.form.to_account_label')} required error={fieldErrors.to_bank_account_id}>
                <Select
                  value={formData.to_bank_account_id}
                  onChange={(e) => setFormData({ ...formData, to_bank_account_id: e.target.value })}
                >
                  <option value="">{t('loans.form.select_account')}</option>
                  {getToCompanyAccounts().map(account => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} ({t('loans.form.balance_label')}{account.current_balance.toLocaleString('hr-HR', { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            <div className="border-t border-gray-200 pt-4"></div>

            <FormField label={t('loans.form.date_label')}>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                <DateInput
                  value={formData.loan_date}
                  onChange={(value) => setFormData({ ...formData, loan_date: value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </FormField>

            <FormField label={t('loans.form.amount_label')} required error={fieldErrors.amount}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">€</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" type="button" onClick={() => { setShowAddModal(false); resetForm() }}>
              {t('loans.form.cancel')}
            </Button>
            <Button variant="primary" type="submit">
              {t('loans.form.save')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('loans.confirm_delete.title')}
        message={t('loans.confirm_delete.message')}
        confirmLabel={t('loans.confirm_delete.confirm')}
        cancelLabel={t('loans.confirm_delete.cancel')}
        variant="danger"
        onConfirm={confirmDeleteLoan}
        onCancel={cancelDeleteLoan}
        loading={deleting}
      />
    </div>
  )
}

export default AccountingLoans
