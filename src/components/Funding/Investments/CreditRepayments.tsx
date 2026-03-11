import React, { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowUpCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { Badge, LoadingSpinner } from '../../ui'
import { format } from 'date-fns'

interface RepaymentInvoice {
  id: string
  invoice_number: string
  issue_date: string
  total_amount: number
  status: string
  company_name: string | null
  bank_name: string | null
  payment_date: string | null
  payment_amount: number | null
  description: string | null
}

interface CreditRepaymentsProps {
  creditId: string
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'gray' }> = {
  PAID: { label: 'Plaćeno', variant: 'green' },
  PARTIALLY_PAID: { label: 'Djelomično', variant: 'yellow' },
  UNPAID: { label: 'Neplaćeno', variant: 'red' },
}

const CreditRepayments: React.FC<CreditRepaymentsProps> = ({ creditId }) => {
  const [expanded, setExpanded] = useState(false)
  const [invoices, setInvoices] = useState<RepaymentInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchRepayments = async () => {
    if (fetched) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounting_invoices')
        .select(`
          id,
          invoice_number,
          issue_date,
          total_amount,
          status,
          description,
          company:accounting_companies(name),
          bank:banks(name),
          payments:accounting_payments(payment_date, amount)
        `)
        .eq('invoice_type', 'INCOMING_BANK')
        .eq('bank_credit_id', creditId)
        .order('issue_date', { ascending: false })

      if (error) throw error

      type RawPaymentEntry = { payment_date: string; amount: number }
      type RawRepaymentInvoice = {
        id: string
        invoice_number: string
        issue_date: string
        total_amount: number
        status: string
        description?: string | null
        company?: { name?: string } | null
        bank?: { name?: string } | null
        payments?: RawPaymentEntry[]
      }
      const mapped: RepaymentInvoice[] = (data || []).map((inv: RawRepaymentInvoice) => {
        const latestPayment = (inv.payments || []).sort(
          (a: RawPaymentEntry, b: RawPaymentEntry) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0]
        const totalPaid = (inv.payments || []).reduce((sum: number, p: RawPaymentEntry) => sum + (p.amount || 0), 0)
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          issue_date: inv.issue_date,
          total_amount: inv.total_amount,
          status: inv.status,
          description: inv.description ?? null,
          company_name: inv.company?.name ?? null,
          bank_name: inv.bank?.name ?? null,
          payment_date: latestPayment?.payment_date ?? null,
          payment_amount: totalPaid || null,
        }
      })

      setInvoices(mapped)
      setFetched(true)
    } catch (err) {
      console.error('Error fetching repayments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (!expanded) fetchRepayments()
    setExpanded((v) => !v)
  }

  const totalRepaid = invoices.reduce((sum, inv) => sum + (inv.payment_amount || 0), 0)

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center space-x-2">
          <ArrowUpCircle className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">
            Uplate kredita
            {fetched && ` (${invoices.length})`}
          </h4>
        </div>
        <div className="flex items-center space-x-3">
          {fetched && invoices.length > 0 && (
            <span className="text-sm font-semibold text-blue-700">
              Ukupno uplaćeno: €{totalRepaid.toLocaleString('hr-HR')}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-4">
              <LoadingSpinner message="Učitavanje uplata..." />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-gray-500 px-4 py-3">
              Nema evidentiranih uplata za ovaj kredit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Broj računa
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Firma
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Investitor
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Datum izdavanja
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Datum plaćanja
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Iznos uplate
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ukupni iznos
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => {
                    const statusCfg = STATUS_CONFIG[inv.status] ?? { label: inv.status, variant: 'gray' as const }
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {inv.invoice_number}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {inv.company_name ?? '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {inv.bank_name ?? '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {format(new Date(inv.issue_date), 'dd.MM.yyyy')}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {inv.payment_date
                            ? format(new Date(inv.payment_date), 'dd.MM.yyyy')
                            : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-blue-700">
                          {inv.payment_amount != null
                            ? `€${inv.payment_amount.toLocaleString('hr-HR')}`
                            : '-'}
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
                <tfoot>
                  <tr className="bg-blue-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-2.5 text-sm font-semibold text-gray-700">
                      Ukupno
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-700">
                      €{totalRepaid.toLocaleString('hr-HR')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                      €{invoices.reduce((s, i) => s + i.total_amount, 0).toLocaleString('hr-HR')}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CreditRepayments
