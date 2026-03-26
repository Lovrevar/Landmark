import React from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="emerald"
        icon={Landmark}
        onClick={onNewLandPurchaseInvoice}
        className="whitespace-nowrap"
      >
        {t('invoices.actions.new_land')}
      </Button>
      <Button
        variant="amber"
        icon={Plus}
        onClick={onNewOfficeInvoice}
        className="whitespace-nowrap"
      >
        {t('invoices.actions.new_office')}
      </Button>
      <Button
        variant="purple"
        icon={ShoppingCart}
        onClick={onNewRetailInvoice}
        className="whitespace-nowrap"
      >
        {t('invoices.actions.new_retail')}
      </Button>
      <Button
        variant="success"
        icon={DollarSign}
        onClick={onNewBankInvoice}
        className="whitespace-nowrap"
      >
        {t('invoices.actions.new_bank')}
      </Button>
      <Button
        variant="primary"
        icon={Plus}
        onClick={onNewInvoice}
        className="whitespace-nowrap"
      >
        {t('invoices.actions.new')}
      </Button>
    </div>
  )
}
