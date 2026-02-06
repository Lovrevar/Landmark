import React from 'react'
import { FileText, Edit, Trash2, DollarSign, Eye, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '../../Common/CurrencyInput'
import { Table, Button, EmptyState } from '../../ui'
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
    <Table>
      <Table.Head>
        <tr>
          {visibleColumns.approved && <Table.Th>Odobreno</Table.Th>}
          {visibleColumns.type && <Table.Th>Tip</Table.Th>}
          {visibleColumns.invoice_number && <Table.Th>Broj računa</Table.Th>}
          {visibleColumns.company && <Table.Th>Firma</Table.Th>}
          {visibleColumns.supplier_customer && <Table.Th>Dobavljač/Kupac</Table.Th>}
          {visibleColumns.category && <Table.Th>Kategorija</Table.Th>}
          {visibleColumns.issue_date && <Table.Th>Datum izdavanja</Table.Th>}
          {visibleColumns.due_date && (
            <Table.Th sortable onClick={() => onSort('due_date')}>
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
            </Table.Th>
          )}
          {visibleColumns.base_amount && <Table.Th>Osnovica</Table.Th>}
          {visibleColumns.vat && <Table.Th>PDV</Table.Th>}
          {visibleColumns.total_amount && <Table.Th>Ukupno</Table.Th>}
          {visibleColumns.paid_amount && <Table.Th>Plaćeno</Table.Th>}
          {visibleColumns.remaining_amount && <Table.Th>Preostalo</Table.Th>}
          {visibleColumns.status && <Table.Th>Status</Table.Th>}
          <Table.Th sticky>Akcije</Table.Th>
        </tr>
      </Table.Head>
      <Table.Body>
        {invoices.length === 0 ? (
          <tr>
            <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}>
              <EmptyState
                icon={FileText}
                title="Nema pronađenih računa"
              />
            </td>
          </tr>
        ) : (
          invoices.map((invoice) => (
            <Table.Tr
              key={invoice.id}
              className={isOverdue(invoice.due_date, invoice.status) ? 'bg-red-50' : ''}
            >
              {visibleColumns.approved && (
                <Table.Td>
                  <div className="flex items-center justify-center w-5 h-5">
                    {invoice.approved ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </Table.Td>
              )}
              {visibleColumns.type && (
                <Table.Td>
                  <span className={`text-xs font-semibold ${getTypeColor(invoice.invoice_type)}`}>
                    {getTypeLabel(invoice.invoice_type)}
                  </span>
                </Table.Td>
              )}
              {visibleColumns.invoice_number && (
                <Table.Td className="font-medium">
                  {invoice.invoice_number}
                </Table.Td>
              )}
              {visibleColumns.company && (
                <Table.Td>
                  {invoice.companies?.name}
                </Table.Td>
              )}
              {visibleColumns.supplier_customer && (
                <Table.Td>
                  {getSupplierCustomerName(invoice)}
                </Table.Td>
              )}
              {visibleColumns.category && (
                <Table.Td className="text-gray-600">
                  {invoice.category}
                </Table.Td>
              )}
              {visibleColumns.issue_date && (
                <Table.Td className="text-gray-600">
                  {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                </Table.Td>
              )}
              {visibleColumns.due_date && (
                <Table.Td className="text-gray-600">
                  <span className={isOverdue(invoice.due_date, invoice.status) ? 'text-red-600 font-semibold' : ''}>
                    {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                  </span>
                </Table.Td>
              )}
              {visibleColumns.base_amount && (
                <Table.Td>
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
                </Table.Td>
              )}
              {visibleColumns.vat && (
                <Table.Td className="text-gray-600">
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
                </Table.Td>
              )}
              {visibleColumns.total_amount && (
                <Table.Td className="font-semibold">
                  €{formatCurrency(invoice.total_amount)}
                </Table.Td>
              )}
              {visibleColumns.paid_amount && (
                <Table.Td className="text-green-600">
                  €{formatCurrency(invoice.paid_amount)}
                </Table.Td>
              )}
              {visibleColumns.remaining_amount && (
                <Table.Td className="text-red-600 font-medium">
                  €{formatCurrency(invoice.remaining_amount)}
                </Table.Td>
              )}
              {visibleColumns.status && (
                <Table.Td>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                    {invoice.status === 'UNPAID' ? 'Neplaćeno' :
                     invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Plaćeno'}
                  </span>
                </Table.Td>
              )}
              <Table.Td sticky>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Eye}
                    onClick={() => onView(invoice)}
                    title="Pregled"
                    className="text-gray-600 hover:bg-gray-50 bg-transparent"
                  />
                  {invoice.status !== 'PAID' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={DollarSign}
                      onClick={() => onPayment(invoice)}
                      title="Plaćanje"
                      className="text-green-600 hover:bg-green-50 bg-transparent"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Edit}
                    onClick={() => onEdit(invoice)}
                    title="Uredi"
                    className="text-blue-600 hover:bg-blue-50 bg-transparent"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Trash2}
                    onClick={() => onDelete(invoice.id)}
                    title="Obriši"
                    className="text-red-600 hover:bg-red-50 bg-transparent"
                  />
                </div>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Body>
    </Table>
  )
}
