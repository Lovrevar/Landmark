import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  LoadingSpinner,
  PageHeader,
  StatGrid,
  StatCard,
  SearchInput,
  Button,
  Badge,
  EmptyState,
  ConfirmDialog
} from '../ui'
import { CheckCircle, EyeOff, FileText, Calendar, AlertCircle, Building2 } from 'lucide-react'
import { format } from 'date-fns'

interface ApprovedInvoice {
  id: string
  invoice_number: string
  invoice_type: string
  invoice_category: string
  issue_date: string
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: string
  description: string
  approved: boolean
  supplier_name?: string
  company_name?: string
  project_name?: string
  phase_name?: string
  contract_number?: string
}

const AccountingApprovals: React.FC = () => {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<ApprovedInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [hideConfirmDialog, setHideConfirmDialog] = useState<{
    isOpen: boolean
    invoiceId: string | null
    invoiceNumber: string | null
  }>({
    isOpen: false,
    invoiceId: null,
    invoiceNumber: null
  })
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    oldestInvoice: null as string | null
  })

  useEffect(() => {
    fetchApprovedInvoices()
  }, [])

  const fetchApprovedInvoices = async () => {
    setLoading(true)
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select(`
          *,
          supplier:subcontractors!accounting_invoices_supplier_id_fkey(
            id,
            name
          ),
          company:accounting_companies!accounting_invoices_company_id_fkey(
            id,
            name
          ),
          project:projects!accounting_invoices_project_id_fkey(
            id,
            name
          ),
          contract:contracts!accounting_invoices_contract_id_fkey(
            id,
            contract_number,
            phase_id
          )
        `)
        .eq('invoice_category', 'SUBCONTRACTOR')
        .eq('approved', true)
        .not('project_id', 'is', null)
        .order('issue_date', { ascending: true })

      if (invoicesError) throw invoicesError

      const { data: hiddenInvoices, error: hiddenError } = await supabase
        .from('hidden_approved_invoices')
        .select('invoice_id')

      if (hiddenError) throw hiddenError

      const hiddenIds = new Set(hiddenInvoices?.map((h) => h.invoice_id) || [])

      const { data: phasesData } = await supabase
        .from('project_phases')
        .select('id, phase_name')

      const phasesMap = new Map(phasesData?.map((p) => [p.id, p.phase_name]) || [])

      const formattedInvoices: ApprovedInvoice[] = (invoicesData || [])
        .filter((inv) => !hiddenIds.has(inv.id))
        .map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_type: inv.invoice_type,
          invoice_category: inv.invoice_category,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          total_amount: parseFloat(inv.total_amount || '0'),
          base_amount: parseFloat(inv.base_amount || '0'),
          vat_amount: parseFloat(inv.vat_amount || '0'),
          status: inv.status,
          description: inv.description || '',
          approved: inv.approved,
          supplier_name: (inv.supplier as any)?.name || 'N/A',
          company_name: (inv.company as any)?.name || 'N/A',
          project_name: (inv.project as any)?.name || 'N/A',
          phase_name:
            inv.contract && (inv.contract as any).phase_id
              ? phasesMap.get((inv.contract as any).phase_id) || 'N/A'
              : 'N/A',
          contract_number: (inv.contract as any)?.contract_number || 'N/A'
        }))

      setInvoices(formattedInvoices)

      const totalAmount = formattedInvoices.reduce((sum, inv) => sum + inv.total_amount, 0)
      const oldestInvoice =
        formattedInvoices.length > 0 ? formattedInvoices[0].issue_date : null

      setStats({
        totalInvoices: formattedInvoices.length,
        totalAmount,
        oldestInvoice
      })
    } catch (error) {
      console.error('Error fetching approved invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleHideInvoice = async () => {
    if (!hideConfirmDialog.invoiceId) return

    if (!user?.id) {
      console.error('User ID not found')
      alert('Greška: Korisnik nije pronađen. Pokušajte se ponovno prijaviti.')
      return
    }

    try {
      const { error } = await supabase.from('hidden_approved_invoices').insert({
        invoice_id: hideConfirmDialog.invoiceId,
        hidden_by: user.id
      })

      if (error) {
        console.error('Supabase error:', error)
        if (error.code === '23505') {
          alert('Ovaj račun je već sakriven.')
        } else {
          throw error
        }
        return
      }

      await fetchApprovedInvoices()
      setHideConfirmDialog({ isOpen: false, invoiceId: null, invoiceNumber: null })
      alert('Račun je uspješno sakriven.')
    } catch (error: any) {
      console.error('Error hiding invoice:', error)
      alert(`Došlo je do greške pri skrivanju računa: ${error.message || 'Nepoznata greška'}`)
    }
  }

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <LoadingSpinner size="lg" message="Učitavanje odobrenih računa..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Odobrenja"
        subtitle="Odobreni računi od podizvodjača koji čekaju obradu"
        icon={CheckCircle}
      />

      <StatGrid columns={3}>
        <StatCard
          title="Računi na čekanju"
          value={stats.totalInvoices.toString()}
          icon={FileText}
          trend={stats.totalInvoices > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          title="Ukupan iznos"
          value={`€${stats.totalAmount.toLocaleString('hr-HR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`}
          icon={Building2}
          trend="neutral"
        />
        <StatCard
          title="Najstariji račun"
          value={
            stats.oldestInvoice
              ? format(new Date(stats.oldestInvoice), 'dd.MM.yyyy')
              : 'N/A'
          }
          icon={Calendar}
          trend={stats.oldestInvoice ? 'down' : 'neutral'}
        />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Pretraži račune..."
            className="max-w-md"
          />
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CheckCircle}
              title="Nema računa za prikaz"
              description="Svi odobreni računi su obrađeni i skriveni."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Broj računa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Dobavljač</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Projekt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Faza</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Datum izdavanja</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Dospijeće</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Osnovica</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PDV</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ukupno</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Akcije</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.invoice_number}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{invoice.supplier_name}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{invoice.project_name}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{invoice.phase_name}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{format(new Date(invoice.due_date), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">
                      €{invoice.base_amount.toLocaleString('hr-HR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">
                      €{invoice.vat_amount.toLocaleString('hr-HR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                      €{invoice.total_amount.toLocaleString('hr-HR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            invoice.status === 'PAID'
                              ? 'success'
                              : invoice.status === 'UNPAID'
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {invoice.status}
                        </Badge>
                        <Badge variant="success">Odobreno</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setHideConfirmDialog({
                            isOpen: true,
                            invoiceId: invoice.id,
                            invoiceNumber: invoice.invoice_number
                          })
                        }
                      >
                        <EyeOff className="w-4 h-4 mr-1" />
                        Sakrij
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {invoices.length > 0 && filteredInvoices.length === 0 && searchTerm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <EmptyState
            icon={AlertCircle}
            title="Nema rezultata pretrage"
            description={`Nema računa koji odgovaraju pretrazi "${searchTerm}".`}
          />
        </div>
      )}

      <ConfirmDialog
        isOpen={hideConfirmDialog.isOpen}
        onClose={() =>
          setHideConfirmDialog({ isOpen: false, invoiceId: null, invoiceNumber: null })
        }
        onConfirm={handleHideInvoice}
        title="Sakrij račun"
        message={`Jeste li sigurni da želite sakriti račun ${hideConfirmDialog.invoiceNumber}? Račun će biti uklonjen s ove stranice, ali će ostati vidljiv u ostalim dijelovima sustava.`}
        confirmText="Sakrij"
        cancelText="Odustani"
      />
    </div>
  )
}

export default AccountingApprovals
