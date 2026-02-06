import React from 'react'
import { Plus, ShoppingCart, DollarSign } from 'lucide-react'
import { Button } from '../../ui'

interface InvoiceActionButtonsProps {
  onNewOfficeInvoice: () => void
  onNewRetailInvoice: () => void
  onNewBankInvoice: () => void
  onNewInvoice: () => void
}

export const InvoiceActionButtons: React.FC<InvoiceActionButtonsProps> = ({
  onNewOfficeInvoice,
  onNewRetailInvoice,
  onNewBankInvoice,
  onNewInvoice
}) => {
  return (
    <div className="flex items-center gap-2">
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
