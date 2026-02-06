import React from 'react'
import { Plus, ShoppingCart, DollarSign } from 'lucide-react'

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
      <button
        onClick={onNewOfficeInvoice}
        className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors duration-200 whitespace-nowrap"
      >
        <Plus className="w-5 h-5 mr-2" />
        Novi Office Račun
      </button>
      <button
        onClick={onNewRetailInvoice}
        className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 whitespace-nowrap"
      >
        <ShoppingCart className="w-5 h-5 mr-2" />
        Novi Retail Račun
      </button>
      <button
        onClick={onNewBankInvoice}
        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 whitespace-nowrap"
      >
        <DollarSign className="w-5 h-5 mr-2" />
        Novi Račun Banka
      </button>
      <button
        onClick={onNewInvoice}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
      >
        <Plus className="w-5 h-5 mr-2" />
        Novi račun
      </button>
    </div>
  )
}
