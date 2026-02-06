import React from 'react'
import { FileText, Edit, Trash2, DollarSign, Eye, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Invoice } from '../types/invoiceTypes'

interface InvoiceTableProps {
  invoices: Invoice[]
  visibleColumns: any
  sortField: 'due_date' | null
  sortDirection: 'asc' | 'desc'
  onSort: (field: 'due_date') => void
  onView: (invoice: Invoice) => void
  onEdit: (invoice: Invoice) => void
  onDelete: (id: string) => void
  onPayment: (invoice: Invoice) => void
  getTypeColor: (type: string) => string
  getTypeLabel: (type: string) => string
  getStatusColor: (status: string) => string
  getSupplierCustomerName: (invoice: Invoice) => string
  isOverdue: (dueDate: string, status: string) => boolean
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  visibleColumns,
  sortField,
  sortDirection,
  onSort,
  onView,
  onEdit,
  onDelete,
  onPayment,
  getTypeColor,
  getTypeLabel,
  getStatusColor,
  getSupplierCustomerName,
  isOverdue
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              {visibleColumns.approved && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Odobreno</th>}
              {visibleColumns.type && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>}
              {visibleColumns.invoice_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>}
              {visibleColumns.company && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>}
              {visibleColumns.supplier_customer && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dobavljač/Kupac</th>}
              {visibleColumns.category && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategorija</th>}
              {visibleColumns.issue_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum izdavanja</th>}
              {visibleColumns.due_date && (
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => onSort('due_date')}
                >
                  <div className="flex items-center gap-1">
                    <span>Dospijeće</span>
                    {sortField === 'due_date' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-4 h-4" />
                      ) : (
                        <ArrowDown className="w-4 h-4" />
                      )
                    ) : (
                      <ArrowUpDown className="w-4 h-4 opacity-40" />
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.base_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Osnovica</th>}
              {visibleColumns.vat && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDV</th>}
              {visibleColumns.total_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ukupno</th>}
              {visibleColumns.paid_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plaćeno</th>}
              {visibleColumns.remaining_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preostalo</th>}
              {visibleColumns.status && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">Akcije</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-6 py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nema pronađenih računa</p>
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={`hover:bg-gray-50 ${isOverdue(invoice.due_date, invoice.status) ? 'bg-red-50' : ''}`}
                >
                  {visibleColumns.approved && (
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center w-5 h-5">
                        {invoice.approved ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <X className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </td>
                  )}
                  {visibleColumns.type && (
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`text-xs font-semibold ${getTypeColor(invoice.invoice_type)}`}>
                        {getTypeLabel(invoice.invoice_type)}
                      </span>
                    </td>
                  )}
                  {visibleColumns.invoice_number && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                  )}
                  {visibleColumns.company && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.companies?.name}
                    </td>
                  )}
                  {visibleColumns.supplier_customer && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getSupplierCustomerName(invoice)}
                    </td>
                  )}
                  {visibleColumns.category && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {invoice.category}
                    </td>
                  )}
                  {visibleColumns.issue_date && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                    </td>
                  )}
                  {visibleColumns.due_date && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={isOverdue(invoice.due_date, invoice.status) ? 'text-red-600 font-semibold' : ''}>
                        {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                      </span>
                    </td>
                  )}
                  {visibleColumns.base_amount && (
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {(invoice.base_amount_1 > 0 || invoice.base_amount_2 > 0 || invoice.base_amount_3 > 0 || invoice.base_amount_4 > 0) ? (
                        <div className="space-y-0.5">
                          {invoice.base_amount_1 > 0 && (
                            <div className="text-xs">€{formatCurrency(invoice.base_amount_1)} <span className="text-gray-400">(25%)</span></div>
                          )}
                          {invoice.base_amount_2 > 0 && (
                            <div className="text-xs">€{formatCurrency(invoice.base_amount_2)} <span className="text-gray-400">(13%)</span></div>
                          )}
                          {invoice.base_amount_4 > 0 && (
                            <div className="text-xs">€{formatCurrency(invoice.base_amount_4)} <span className="text-gray-400">(5%)</span></div>
                          )}
                          {invoice.base_amount_3 > 0 && (
                            <div className="text-xs">€{formatCurrency(invoice.base_amount_3)} <span className="text-gray-400">(0%)</span></div>
                          )}
                        </div>
                      ) : (
                        <div>€{formatCurrency(invoice.base_amount)}</div>
                      )}
                    </td>
                  )}
                  {visibleColumns.vat && (
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {(invoice.base_amount_1 > 0 || invoice.base_amount_2 > 0 || invoice.base_amount_3 > 0 || invoice.base_amount_4 > 0) ? (
                        <div className="space-y-0.5">
                          {invoice.base_amount_1 > 0 && (
                            <div className="text-xs">25%: €{formatCurrency(invoice.vat_amount_1 || invoice.base_amount_1 * 0.25)}</div>
                          )}
                          {invoice.base_amount_2 > 0 && (
                            <div className="text-xs">13%: €{formatCurrency(invoice.vat_amount_2 || invoice.base_amount_2 * 0.13)}</div>
                          )}
                          {invoice.base_amount_4 > 0 && (
                            <div className="text-xs">5%: €{formatCurrency(invoice.vat_amount_4 || invoice.base_amount_4 * 0.05)}</div>
                          )}
                          {invoice.base_amount_3 > 0 && (
                            <div className="text-xs">0%: €0,00</div>
                          )}
                        </div>
                      ) : (
                        <div>{invoice.vat_rate}%: €{formatCurrency(invoice.vat_amount)}</div>
                      )}
                    </td>
                  )}
                  {visibleColumns.total_amount && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      €{formatCurrency(invoice.total_amount)}
                    </td>
                  )}
                  {visibleColumns.paid_amount && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600">
                      €{formatCurrency(invoice.paid_amount)}
                    </td>
                  )}
                  {visibleColumns.remaining_amount && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      €{formatCurrency(invoice.remaining_amount)}
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status === 'UNPAID' ? 'Neplaćeno' :
                         invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Plaćeno'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap text-sm sticky right-0 bg-white">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onView(invoice)}
                        title="Pregled"
                        className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors duration-200"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {invoice.status !== 'PAID' && (
                        <button
                          onClick={() => onPayment(invoice)}
                          title="Plaćanje"
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(invoice)}
                        title="Uredi"
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(invoice.id)}
                        title="Obriši"
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
