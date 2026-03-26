import React from 'react'
import { Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import CreditInvoiceSection from './CreditInvoiceSection'

const CreditExpenses: React.FC<{ creditId: string }> = ({ creditId }) => {
  const { t } = useTranslation()
  return (
    <CreditInvoiceSection
      creditId={creditId}
      invoiceType="INCOMING_BANK_EXPENSES"
      title={t('funding.credit_expenses.title')}
      totalLabel={t('funding.credit_expenses.total_label')}
      paymentAmountLabel={t('funding.credit_expenses.payment_amount_label')}
      emptyMessage={t('funding.credit_expenses.empty')}
      accentColor="amber"
      icon={Receipt}
    />
  )
}

export default CreditExpenses
