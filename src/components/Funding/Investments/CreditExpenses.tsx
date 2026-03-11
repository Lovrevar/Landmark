import React from 'react'
import { Receipt } from 'lucide-react'
import CreditInvoiceSection from './CreditInvoiceSection'

const CreditExpenses: React.FC<{ creditId: string }> = ({ creditId }) => (
  <CreditInvoiceSection
    creditId={creditId}
    invoiceType="INCOMING_BANK_EXPENSES"
    title="Troškovi kredita"
    totalLabel="Ukupno troškovi"
    paymentAmountLabel="Plaćeno"
    emptyMessage="Nema evidentiranih troškova za ovaj kredit."
    accentColor="amber"
    icon={Receipt}
  />
)

export default CreditExpenses
