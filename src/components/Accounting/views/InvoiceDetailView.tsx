import React from 'react'
import { X, Check } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Invoice } from '../types/invoiceTypes'

interface InvoiceDetailViewProps {
  invoice: Invoice | null
  onClose: () => void
  getTypeColor: (type: string) => string
  getTypeLabel: (type: string) => string
  getStatusColor: (status: string) => string
  getSupplierCustomerName: (invoice: Invoice) => string
  isOverdue: (dueDate: string, status: string) => boolean
}

export const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({
  invoice,
  onClose,
  getTypeColor,
  getTypeLabel,
  getStatusColor,
  getSupplierCustomerName,
  isOverdue
}) => {
  if (!invoice) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Detalji računa</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Osnovni podaci</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Broj računa:</span>
                  <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Tip računa:</span>
                  <p className={`text-sm font-semibold ${getTypeColor(invoice.invoice_type)}`}>
                    {getTypeLabel(invoice.invoice_type)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Status:</span>
                  <p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status === 'UNPAID' ? 'Neplaćeno' :
                       invoice.status === 'PARTIALLY_PAID' ? 'Djelomično plaćeno' : 'Plaćeno'}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Odobren:</span>
                  <p className="flex items-center gap-2">
                    {invoice.approved ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <Check className="w-4 h-4" /> Da
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <X className="w-4 h-4" /> Ne
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Datumi</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Datum izdavanja:</span>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Datum dospijeća:</span>
                  <p className={`text-sm font-medium ${isOverdue(invoice.due_date, invoice.status) ? 'text-red-600' : 'text-gray-900'}`}>
                    {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                    {isOverdue(invoice.due_date, invoice.status) && (
                      <span className="ml-2 text-xs">(Zakašnjelo)</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Datum kreiranja:</span>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(invoice.created_at), 'dd.MM.yyyy HH:mm')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Subjekti</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Kompanija:</span>
                <p className="text-sm font-medium text-gray-900">{invoice.companies?.name || '-'}</p>
              </div>
              {(invoice.subcontractors || invoice.customers || invoice.investors ||
                invoice.banks || invoice.office_suppliers || invoice.retail_suppliers ||
                invoice.retail_customers) && (
                <div>
                  <span className="text-sm text-gray-500">
                    {invoice.invoice_type.includes('SUPPLIER') ? 'Dobavljač' :
                     invoice.invoice_type.includes('SALES') ? 'Kupac' :
                     invoice.invoice_type.includes('INVESTMENT') ? 'Investitor' :
                     invoice.invoice_type.includes('BANK') ? 'Banka' :
                     invoice.invoice_type.includes('OFFICE') ? 'Office dobavljač' : 'Partner'}:
                  </span>
                  <p className="text-sm font-medium text-gray-900">
                    {getSupplierCustomerName(invoice) || '-'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {(invoice.projects || invoice.contracts) && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Projekti i ugovori</h3>
              <div className="grid grid-cols-2 gap-4">
                {invoice.projects && (
                  <div>
                    <span className="text-sm text-gray-500">Projekt:</span>
                    <p className="text-sm font-medium text-gray-900">{invoice.projects.name}</p>
                  </div>
                )}
                {invoice.contracts && (
                  <div>
                    <span className="text-sm text-gray-500">Ugovor:</span>
                    <p className="text-sm font-medium text-gray-900">
                      {invoice.contracts.contract_number}
                      {invoice.contracts.job_description && (
                        <span className="block text-xs text-gray-600 mt-1">
                          {invoice.contracts.job_description}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(invoice.reference_number || invoice.iban) && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Platni detalji</h3>
              <div className="grid grid-cols-2 gap-4">
                {invoice.reference_number && (
                  <div>
                    <span className="text-sm text-gray-500">Poziv na broj:</span>
                    <p className="text-sm font-medium text-gray-900">{invoice.reference_number}</p>
                  </div>
                )}
                {invoice.iban && (
                  <div>
                    <span className="text-sm text-gray-500">IBAN:</span>
                    <p className="text-sm font-medium text-gray-900">{invoice.iban}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Financijski podaci</h3>
            <div className="space-y-3">
              {(invoice.base_amount_1 > 0 || invoice.base_amount_2 > 0 ||
                invoice.base_amount_3 > 0 || invoice.base_amount_4 > 0) ? (
                <div>
                  <span className="text-sm text-gray-500 mb-2 block">Osnovica po stopama PDV-a:</span>
                  <div className="bg-gray-50 p-3 rounded space-y-2">
                    {invoice.base_amount_1 > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">25% PDV:</span>
                        <div className="text-right">
                          <p className="text-sm font-medium">Osnovica: €{formatCurrency(invoice.base_amount_1)}</p>
                          <p className="text-xs text-gray-600">PDV: €{formatCurrency(invoice.vat_amount_1 || invoice.base_amount_1 * 0.25)}</p>
                        </div>
                      </div>
                    )}
                    {invoice.base_amount_2 > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">13% PDV:</span>
                        <div className="text-right">
                          <p className="text-sm font-medium">Osnovica: €{formatCurrency(invoice.base_amount_2)}</p>
                          <p className="text-xs text-gray-600">PDV: €{formatCurrency(invoice.vat_amount_2 || invoice.base_amount_2 * 0.13)}</p>
                        </div>
                      </div>
                    )}
                    {invoice.base_amount_4 > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">5% PDV:</span>
                        <div className="text-right">
                          <p className="text-sm font-medium">Osnovica: €{formatCurrency(invoice.base_amount_4)}</p>
                          <p className="text-xs text-gray-600">PDV: €{formatCurrency(invoice.vat_amount_4 || invoice.base_amount_4 * 0.05)}</p>
                        </div>
                      </div>
                    )}
                    {invoice.base_amount_3 > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">0% PDV:</span>
                        <div className="text-right">
                          <p className="text-sm font-medium">Osnovica: €{formatCurrency(invoice.base_amount_3)}</p>
                          <p className="text-xs text-gray-600">PDV: €0.00</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Osnovica:</span>
                  <p className="text-sm font-medium text-gray-900">€{formatCurrency(invoice.base_amount)}</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Ukupan PDV:</span>
                <p className="text-sm font-medium text-gray-900">€{formatCurrency(invoice.vat_amount)}</p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-base font-semibold text-gray-700">Ukupan iznos:</span>
                <p className="text-lg font-bold text-gray-900">€{formatCurrency(invoice.total_amount)}</p>
              </div>

              <div className="flex justify-between items-center bg-green-50 p-2 rounded">
                <span className="text-sm text-green-700">Plaćeni iznos:</span>
                <p className="text-sm font-semibold text-green-700">€{formatCurrency(invoice.paid_amount)}</p>
              </div>

              {invoice.remaining_amount > 0 && (
                <div className="flex justify-between items-center bg-red-50 p-2 rounded">
                  <span className="text-sm text-red-700">Preostali iznos:</span>
                  <p className="text-sm font-semibold text-red-700">€{formatCurrency(invoice.remaining_amount)}</p>
                </div>
              )}
            </div>
          </div>

          {invoice.category && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Kategorija</h3>
              <p className="text-sm font-medium text-gray-900">{invoice.category}</p>
            </div>
          )}

          {invoice.description && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Opis</h3>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{invoice.description}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  )
}
