import React from 'react'
import { ArrowUpCircle } from 'lucide-react'
import CreditInvoiceSection from './CreditInvoiceSection'

const CreditRepayments: React.FC<{ creditId: string }> = ({ creditId }) => (
  <CreditInvoiceSection
    creditId={creditId}
    invoiceType="INCOMING_BANK"
    title="Uplate kredita"
    totalLabel="Ukupno uplaćeno"
    paymentAmountLabel="Iznos uplate"
    emptyMessage="Nema evidentiranih uplata za ovaj kredit."
    accentColor="blue"
    icon={ArrowUpCircle}
  />
)

export default CreditRepayments
