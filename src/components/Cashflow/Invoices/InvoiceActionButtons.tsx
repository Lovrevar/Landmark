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
        variant="emerald"
        icon={Landmark}
        onClick={onNewLandPurchaseInvoice}
        className="whitespace-nowrap"
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
        variant="purple"
        icon={ShoppingCart}
        onClick={onNewRetailInvoice}
        className="whitespace-nowrap"
      >
        Novi Retail Račun
      </Button>
      <Button
        variant="success"
        icon={DollarSign}
        onClick={onNewBankInvoice}
        className="whitespace-nowrap"
      >
        Investicije
      </Button>
      <Button
        variant="primary"
        icon={Plus}
        onClick={onNewInvoice}
        className="whitespace-nowrap"
      >
        Novi račun
      </Button>
    </div>
  )
}
