import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, LoadingSpinner, Button, ConfirmDialog } from '../../ui'
import { useBankData }   from './hooks/useBankData'
import { useBankForm }   from './hooks/useBankForm'
import { useCreditForm } from './hooks/useCreditForm'
import { useEquityForm } from './hooks/useEquityForm'
import InvestorCard         from './components/InvestorCard'
import InvestorFormModal    from './modals/InvestorFormModal'
import CreditFormModal      from './modals/CreditFormModal'
import EquityFormModal      from './modals/EquityFormModal'
import InvestorDetailModal  from './modals/InvestorDetailModal'
import type { BankWithCredits } from './types'
import type { BankCredit } from '../../../lib/supabase'

const InvestorsManagement: React.FC = () => {
  const { t } = useTranslation()
  const {
    banks, companies, loading, addBank, updateBank, deleteBank, fetchData,
    pendingDeleteId: pendingDeleteBankId,
    confirmDeleteBank,
    cancelDeleteBank,
    deleting: deletingBank
  } = useBankData()
  const [selectedBank, setSelectedBank] = useState<BankWithCredits | null>(null)

  React.useEffect(() => {
    if (selectedBank) {
      const refreshed = banks.find(b => b.id === selectedBank.id)
      if (refreshed) setSelectedBank(refreshed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banks])

  const bankForm   = useBankForm()
  const creditForm = useCreditForm(fetchData)
  const equityForm = useEquityForm(fetchData)

  if (loading) return <LoadingSpinner message={t('funding.investors.loading')} />

  return (
    <div>
      <PageHeader
        title={t('funding.investors.title')}
        description={t('funding.investors.description')}
        actions={
          <div className="flex space-x-3">
            <Button icon={Plus} onClick={() => bankForm.setShowBankForm(true)}>{t('funding.investors.add_investor')}</Button>
            <Button icon={Plus} variant="success" onClick={() => creditForm.setShowCreditForm(true)}>{t('funding.investors.add_loan')}</Button>
            <Button icon={Plus} variant="primary" onClick={() => equityForm.setShowEquityForm(true)}>{t('funding.investors.add_equity')}</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {banks.map(bank => (
          <InvestorCard
            key={bank.id}
            bank={bank}
            onSelect={setSelectedBank}
            onEdit={bankForm.handleEditBank}
            onDelete={deleteBank}
          />
        ))}
      </div>

      <InvestorFormModal
        show={bankForm.showBankForm}
        onClose={bankForm.resetBankForm}
        editingBank={bankForm.editingBank}
        formData={bankForm.newBank}
        onChange={bankForm.setNewBank}
        onSubmit={bankForm.editingBank
          ? () => updateBank(bankForm.editingBank!, bankForm.newBank, bankForm.resetBankForm)
          : () => addBank(bankForm.newBank, bankForm.resetBankForm)
        }
      />

      <CreditFormModal
        show={creditForm.showCreditForm}
        onClose={creditForm.resetCreditForm}
        editingCredit={creditForm.editingCredit}
        banks={banks}
        companies={companies}
        companyBankAccounts={creditForm.companyBankAccounts}
        loadingAccounts={creditForm.loadingAccounts}
        formData={creditForm.newCredit}
        onChange={(data) => creditForm.setNewCredit(prev => ({ ...prev, ...data }))}
        onSubmit={creditForm.addCredit}
      />

      <InvestorDetailModal
        bank={selectedBank}
        allBanks={banks}
        onClose={() => setSelectedBank(null)}
        onEditCredit={(credit: BankCredit) => { creditForm.handleEditCredit(credit); setSelectedBank(null) }}
        onDeleteCredit={creditForm.handleDeleteCredit}
      />

      <EquityFormModal
        show={equityForm.showEquityForm}
        onClose={() => equityForm.setShowEquityForm(false)}
        banks={banks}
        companies={companies}
        formData={equityForm.newEquity}
        onChange={(data) => equityForm.setNewEquity(prev => ({ ...prev, ...data }))}
        onSubmit={equityForm.addEquity}
      />

      <ConfirmDialog
        show={!!pendingDeleteBankId}
        title={t('funding.investors.confirm_delete_bank_title')}
        message={t('funding.investors.confirm_delete_bank_message')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteBank}
        onCancel={cancelDeleteBank}
        loading={deletingBank}
      />

      <ConfirmDialog
        show={!!creditForm.pendingDeleteId}
        title={t('funding.investors.confirm_delete_credit_title')}
        message={t('funding.investors.confirm_delete_credit_message')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={creditForm.confirmDeleteCredit}
        onCancel={creditForm.cancelDeleteCredit}
        loading={creditForm.deleting}
      />
    </div>
  )
}

export default InvestorsManagement
