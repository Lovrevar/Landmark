import React from 'react'
import { format } from 'date-fns'
import { Building2, CreditCard, Banknote, ArrowLeftRight } from 'lucide-react'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Payment } from '../types/paymentTypes'
import { Modal, Button } from '../../ui'
import { getPaymentMethodLabel } from '../utils/paymentHelpers'

interface PaymentDetailViewProps {
  payment: Payment | null
  onClose: () => void
}

export const PaymentDetailView: React.FC<PaymentDetailViewProps> = ({
  payment,
  onClose
}) => {
  if (!payment) return null

  const invoice = payment.accounting_invoices

  const getInvoiceTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOMING_SUPPLIER':
        return 'Ulazni dobavljač'
      case 'OUTGOING_SUPPLIER':
        return 'Izlazni dobavljač'
      case 'INCOMING_INVESTMENT':
        return 'Ulazni investitor'
      case 'OUTGOING_SALES':
        return 'Izlazni prodaja'
      case 'INCOMING_OFFICE':
        return 'Ulazni ured'
      case 'OUTGOING_OFFICE':
        return 'Izlazni ured'
      case 'INCOMING_BANK':
        return 'Ulazni banka'
      case 'OUTGOING_BANK':
        return 'Izlazni banka'
      default:
        return type
    }
  }

  const getSupplierCustomerName = () => {
    if (!invoice) return '-'
    return (
      invoice.bank_company?.name ||
      invoice.office_suppliers?.name ||
      invoice.retail_suppliers?.name ||
      invoice.subcontractors?.name ||
      (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '') ||
      invoice.companies?.name ||
      '-'
    )
  }

  const isExpense = invoice?.invoice_type === 'INCOMING_SUPPLIER' ||
    invoice?.invoice_type === 'OUTGOING_SUPPLIER' ||
    invoice?.invoice_type === 'INCOMING_OFFICE' ||
    invoice?.invoice_type === 'OUTGOING_BANK'

  return (
    <Modal show={!!payment} onClose={onClose} size="lg">
      <Modal.Header title="Detalji plaćanja" onClose={onClose} />

      <Modal.Body className="px-6 py-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Osnovni podaci</h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Datum plaćanja:</span>
                <p className="text-sm font-medium text-gray-900">
                  {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Način plaćanja:</span>
                <p className="text-sm font-medium text-gray-900">
                  {getPaymentMethodLabel(payment.payment_method)}
                </p>
              </div>
              {payment.reference_number && (
                <div>
                  <span className="text-sm text-gray-500">Referentni broj:</span>
                  <p className="text-sm font-medium text-gray-900">{payment.reference_number}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-500">Iznos plaćanja:</span>
                <p className="text-lg font-bold text-green-600">
                  &euro;{formatCurrency(payment.amount)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Račun</h3>
            <div className="space-y-2">
              {invoice && (
                <>
                  <div>
                    <span className="text-sm text-gray-500">Broj računa:</span>
                    <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Tip računa:</span>
                    <p className={`text-sm font-semibold ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
                      {getInvoiceTypeLabel(invoice.invoice_type)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Ukupan iznos računa:</span>
                    <p className="text-sm font-medium text-gray-900">
                      &euro;{formatCurrency(invoice.total_amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Preostali iznos:</span>
                    <p className={`text-sm font-medium ${invoice.remaining_amount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      &euro;{formatCurrency(invoice.remaining_amount)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {invoice && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Subjekti</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Moja Firma:</span>
                <p className="text-sm font-medium text-gray-900">{invoice.companies?.name || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Firma/Dobavljač:</span>
                <p className="text-sm font-medium text-gray-900">{getSupplierCustomerName()}</p>
              </div>
            </div>
          </div>
        )}

        {(payment.payment_source_type || payment.company_bank_account || payment.bank_credit) && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Izvor plaćanja</h3>
            {payment.payment_source_type === 'kompenzacija' ? (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <ArrowLeftRight className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Kompenzacija</p>
                  <p className="text-xs text-amber-600">Plaćanje putem kompenzacije</p>
                </div>
              </div>
            ) : payment.payment_source_type === 'credit' && payment.bank_credit ? (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <CreditCard className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs text-blue-500 uppercase tracking-wide font-medium mb-0.5">Kredit</p>
                  <p className="text-sm font-semibold text-blue-900">{payment.bank_credit.credit_name}</p>
                  {payment.bank_credit.company?.name && (
                    <p className="text-xs text-blue-600">{payment.bank_credit.company.name}</p>
                  )}
                </div>
              </div>
            ) : payment.payment_source_type === 'bank_account' && payment.company_bank_account ? (
              <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
                <Building2 className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <p className="text-xs text-teal-500 uppercase tracking-wide font-medium mb-0.5">Bankovni račun</p>
                  <p className="text-sm font-semibold text-teal-900">{payment.company_bank_account.bank_name}</p>
                  {payment.company_bank_account.iban && (
                    <p className="text-xs text-teal-600 font-mono">{payment.company_bank_account.iban}</p>
                  )}
                </div>
              </div>
            ) : payment.payment_source_type === 'bank_account' && !payment.company_bank_account ? (
              <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
                <Building2 className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-teal-900">Bankovni račun</p>
                </div>
              </div>
            ) : payment.payment_source_type === 'credit' && !payment.bank_credit ? (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <CreditCard className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Kredit</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {payment.is_cesija && payment.cesija_company_name && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Cesija</h3>
            <div className="bg-purple-50 p-3 rounded">
              <div className="flex items-center gap-2">
                <span className="text-sm text-purple-700 font-medium">Ovo je cesija plaćanje</span>
              </div>
              <div className="mt-2">
                <span className="text-sm text-purple-600">Cesija firma:</span>
                <p className="text-sm font-medium text-purple-900">{payment.cesija_company_name}</p>
              </div>
            </div>
          </div>
        )}

        {payment.description && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Opis</h3>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{payment.description}</p>
          </div>
        )}

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Dodatne informacije</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Kreirano:</span>
              <p className="text-sm font-medium text-gray-900">
                {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer sticky>
        <Button variant="secondary" onClick={onClose}>
          Zatvori
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
