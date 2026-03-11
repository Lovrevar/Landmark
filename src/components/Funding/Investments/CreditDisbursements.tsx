import React from 'react'
import { ArrowDownCircle } from 'lucide-react'
import CreditInvoiceSection from './CreditInvoiceSection'

const CreditDisbursements: React.FC<{ creditId: string }> = ({ creditId }) => (
  <CreditInvoiceSection
    creditId={creditId}
    invoiceType="OUTGOING_BANK"
    title="Isplate kredita"
    totalLabel="Ukupno isplaćeno"
    paymentAmountLabel="Iznos isplate"
    emptyMessage="Nema evidentiranih isplata za ovaj kredit."
    accentColor="emerald"
    icon={ArrowDownCircle}
    showAllocation
  />
)

export default CreditDisbursements
