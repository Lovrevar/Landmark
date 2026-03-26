import React from 'react'
import { ArrowDownCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import CreditInvoiceSection from './CreditInvoiceSection'

const CreditDisbursements: React.FC<{ creditId: string }> = ({ creditId }) => {
  const { t } = useTranslation()
  return (
    <CreditInvoiceSection
      creditId={creditId}
      invoiceType="OUTGOING_BANK"
      title={t('funding.credit_disbursements.title')}
      totalLabel={t('funding.credit_disbursements.total_label')}
      paymentAmountLabel={t('funding.credit_disbursements.payment_amount_label')}
      emptyMessage={t('funding.credit_disbursements.empty')}
      accentColor="emerald"
      icon={ArrowDownCircle}
      showAllocation
    />
  )
}

export default CreditDisbursements
