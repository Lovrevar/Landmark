import React from 'react'
import { ArrowUpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import CreditInvoiceSection from './CreditInvoiceSection'

const CreditRepayments: React.FC<{ creditId: string }> = ({ creditId }) => {
  const { t } = useTranslation()
  return (
    <CreditInvoiceSection
      creditId={creditId}
      invoiceType="INCOMING_BANK"
      title={t('funding.credit_repayments.title')}
      totalLabel={t('funding.credit_repayments.total_label')}
      paymentAmountLabel={t('funding.credit_repayments.payment_amount_label')}
      emptyMessage={t('funding.credit_repayments.empty')}
      accentColor="blue"
      icon={ArrowUpCircle}
    />
  )
}

export default CreditRepayments
