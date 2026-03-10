import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, FileText } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { Badge, LoadingSpinner } from '../../ui'
import { format } from 'date-fns'

interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  created_at: string
  allocation_type: 'project' | 'opex' | 'refinancing'
  refinancing_entity_type?: 'company' | 'bank' | null
  refinancing_entity_id?: string | null
  project?: { id: string; name: string }
  refinancing_company?: { id: string; name: string }
  refinancing_bank?: { id: string; name: string }
}

interface BankCredit {
  id: string
  disbursed_to_account?: boolean
}

interface AllocationInvoice {
  payment_id: string
  payment_date: string
  payment_amount: number
  invoice_id: string
  invoice_number: string
  total_amount: number
  paid_amount: number
  status: string
  description: string | null
  supplier_name: string | null
}

interface AllocationRowProps {
  allocation: CreditAllocation
  credit: BankCredit
  allocationKey: string
  isExpanded: boolean
  onToggle: (key: string) => void
  onDelete: (allocationId: string, creditId: string) => void
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'gray' }> = {
  PAID: { label: 'Plaćeno', variant: 'green' },
  PARTIALLY_PAID: { label: 'Djelomično', variant: 'yellow' },
  UNPAID: { label: 'Neplaćeno', variant: 'red' },
}

const AllocationRow: React.FC<AllocationRowProps> = ({
  allocation,
  credit,
  allocationKey,
  isExpanded,
  onToggle,
  onDelete,
}) => {
  const [invoicesExpanded, setInvoicesExpanded] = useState(false)
  const [invoices, setInvoices] = useState<AllocationInvoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [invoicesFetched, setInvoicesFetched] = useState(false)

  const fetchInvoices = async () => {
    if (invoicesFetched) return
    setInvoicesLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounting_payments')
        .select(`
          id,
          payment_date,
          amount,
          invoice:accounting_invoices(
            id,
            invoice_number,
            total_amount,
            paid_amount,
            status,
            description,
            supplier:subcontractors(name),
            office_supplier:office_suppliers(name),
            retail_supplier:retail_suppliers(name)
          )
        `)
        .eq('credit_allocation_id', allocation.id)
        .order('payment_date', { ascending: false })

      if (error) throw error

      const mapped: AllocationInvoice[] = (data || []).map((p: any) => ({
        payment_id: p.id,
        payment_date: p.payment_date,
        payment_amount: p.amount,
        invoice_id: p.invoice?.id ?? '',
        invoice_number: p.invoice?.invoice_number ?? '-',
        total_amount: p.invoice?.total_amount ?? 0,
        paid_amount: p.invoice?.paid_amount ?? 0,
        status: p.invoice?.status ?? 'UNKNOWN',
        description: p.invoice?.description ?? null,
        supplier_name:
          p.invoice?.supplier?.name ??
          p.invoice?.office_supplier?.name ??
          p.invoice?.retail_supplier?.name ??
          null,
      }))

      setInvoices(mapped)
      setInvoicesFetched(true)
    } catch (err) {
      console.error('Error fetching allocation invoices:', err)
    } finally {
      setInvoicesLoading(false)
    }
  }

  const handleToggleInvoices = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!invoicesExpanded) fetchInvoices()
    setInvoicesExpanded((v) => !v)
  }

  const allocationLabel =
    allocation.allocation_type === 'project'
      ? allocation.project?.name ?? 'Projekt'
      : allocation.allocation_type === 'opex'
      ? 'OPEX (Bez projekta)'
      : `Refinanciranje - ${allocation.refinancing_company?.name ?? allocation.refinancing_bank?.name ?? 'N/A'}`

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => onToggle(allocationKey)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
          <span className="font-semibold text-gray-900">{allocationLabel}</span>
          {allocation.allocation_type === 'refinancing' && (
            <Badge variant="orange" className="ml-2">
              {allocation.refinancing_entity_type === 'company' ? 'FIRMA' : 'BANKA'}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm text-gray-600">
              Alocirano:{' '}
              <span className="font-semibold text-blue-600">
                €{allocation.allocated_amount.toLocaleString('hr-HR')}
              </span>
            </div>
            {credit.disbursed_to_account ? (
              <div className="text-xs text-gray-500">
                Isplaćeno:{' '}
                <span className="font-semibold text-green-600">
                  €{allocation.allocated_amount.toLocaleString('hr-HR')}
                </span>
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                Iskorišteno: €{allocation.used_amount.toLocaleString('hr-HR')} |{' '}
                Dostupno:{' '}
                <span
                  className={
                    allocation.allocated_amount - allocation.used_amount < 0
                      ? 'text-red-600 font-semibold'
                      : 'text-green-600 font-semibold'
                  }
                >
                  €{(allocation.allocated_amount - allocation.used_amount).toLocaleString('hr-HR')}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(allocation.id, allocation.credit_id)
            }}
            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 space-y-4">
          {allocation.description && (
            <p className="text-sm text-gray-600">{allocation.description}</p>
          )}

          {credit.disbursed_to_account ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Alocirano</p>
                <p className="font-semibold text-blue-600">
                  €{allocation.allocated_amount.toLocaleString('hr-HR')}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Isplaćeno</p>
                <p className="font-semibold text-green-600">
                  €{allocation.allocated_amount.toLocaleString('hr-HR')}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Alocirano</p>
                <p className="font-semibold text-blue-600">
                  €{allocation.allocated_amount.toLocaleString('hr-HR')}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Iskorišteno</p>
                <p className="font-semibold text-orange-600">
                  €{allocation.used_amount.toLocaleString('hr-HR')}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Dostupno</p>
                <p
                  className={`font-semibold ${
                    allocation.allocated_amount - allocation.used_amount < 0
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  €{(allocation.allocated_amount - allocation.used_amount).toLocaleString('hr-HR')}
                </p>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={handleToggleInvoices}
              className="w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between text-sm"
            >
              <div className="flex items-center space-x-2 text-gray-700 font-medium">
                <FileText className="w-4 h-4" />
                <span>
                  Računi plaćeni ovom alokacijom
                  {invoicesFetched && ` (${invoices.length})`}
                </span>
              </div>
              {invoicesExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {invoicesExpanded && (
              <div className="bg-white border-t border-gray-200">
                {invoicesLoading ? (
                  <div className="p-4">
                    <LoadingSpinner message="Učitavanje računa..." />
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-gray-500 px-4 py-3">
                    Nema računa plaćenih ovom alokacijom.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Broj računa
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Dobavljac
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Datum plaćanja
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Iznos plaćanja
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Ukupni iznos
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {invoices.map((inv) => {
                          const statusCfg = STATUS_CONFIG[inv.status] ?? { label: inv.status, variant: 'gray' as const }
                          return (
                            <tr key={inv.payment_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-gray-900">
                                {inv.invoice_number}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">
                                {inv.supplier_name ?? '-'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600">
                                {format(new Date(inv.payment_date), 'dd.MM.yyyy')}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-blue-700">
                                €{inv.payment_amount.toLocaleString('hr-HR')}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-700">
                                €{inv.total_amount.toLocaleString('hr-HR')}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <Badge variant={statusCfg.variant}>
                                  {statusCfg.label}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AllocationRow
