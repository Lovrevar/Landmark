import React from 'react'
import { Plus, ShoppingCart, DollarSign, Landmark } from 'lucide-react'
import { Button } from '../../ui'

interface InvoiceActionButtonsProps {
  onNewOfficeInvoice: () => void
  onNewRetailInvoice: () => void
  onNewBankInvoice: () => void
  onNewLandPurchaseInvoice: () => void
  onNewInvoice: () => void
}

export const InvoiceActionButtons: React.FC<InvoiceActionButtonsProps> = ({
  onNewOfficeInvoice,
  onNewRetailInvoice,
  onNewBankInvoice,
  onNewLandPurchaseInvoice,
  onNewInvoice
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        icon={Landmark}
        onClick={onNewLandPurchaseInvoice}
        className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
      >
        Kupoprodaja Zemljišta
      </Button>
      <Button
        variant="amber"
        icon={Plus}
        onClick={onNewOfficeInvoice}
        className="whitespace-nowrap"
      >
        Novi Office Račun
      </Button>
      <Button
        variant="primary"
        icon={ShoppingCart}
        onClick={onNewRetailInvoice}
        className="bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
      >
        Novi Retail Račun
      </Button>
      <Button
        variant="success"
        icon={DollarSign}
        onClick={onNewBankInvoice}
        className="whitespace-nowrap"
      >
        Novi Račun Banka
      </Button>
      <button
        onClick={onNewInvoice}
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 whitespace-nowrap"
      >
        <Plus className="w-4 h-4 mr-2" />
        Novi račun
      </button>
    </div>
  )
}
