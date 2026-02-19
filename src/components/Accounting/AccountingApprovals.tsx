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
import { CheckCircle, EyeOff, FileText, Calendar, AlertCircle, Building2, CheckSquare } from 'lucide-react'
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hideConfirmDialog, setHideConfirmDialog] = useState<{
    isOpen: boolean
    invoiceId: string | null
    invoiceNumber: string | null
  }>({
    isOpen: false,
    invoiceId: null,
    invoiceNumber: null
  })
  const [bulkHideConfirmOpen, setBulkHideConfirmOpen] = useState(false)
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
      setSelectedIds(new Set())

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

  const hideInvoiceById = async (invoiceId: string) => {
    if (!user?.id) return
    const { error } = await supabase.from('hidden_approved_invoices').insert({
      invoice_id: invoiceId,
      hidden_by: user.id
    })
    if (error && error.code !== '23505') throw error
  }

  const handleHideInvoice = async () => {
    if (!hideConfirmDialog.invoiceId || !user?.id) {
      alert('Greška: Korisnik ili ID računa nisu pronađeni.')
      return
    }
    try {
      await hideInvoiceById(hideConfirmDialog.invoiceId)
      await fetchApprovedInvoices()
      setHideConfirmDialog({ isOpen: false, invoiceId: null, invoiceNumber: null })
    } catch (error: any) {
      alert(`Došlo je do greške pri skrivanju računa: ${error.message || 'Nepoznata greška'}`)
    }
  }

  const handleBulkHide = async () => {
    if (!user?.id) {
      alert('Greška: Korisnik nije pronađen.')
      return
    }
    try {
      for (const id of selectedIds) {
        await hideInvoiceById(id)
      }
      await fetchApprovedInvoices()
      setBulkHideConfirmOpen(false)
    } catch (error: any) {
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

  const allFilteredSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => selectedIds.has(inv.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredInvoices.forEach((inv) => next.delete(inv.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredInvoices.forEach((inv) => next.add(inv.id))
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCount = selectedIds.size
  const selectedTotal = invoices
    .filter((inv) => selectedIds.has(inv.id))
    .reduce((sum, inv) => sum + inv.total_amount, 0)

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
        <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Pretraži račune..."
            className="max-w-md"
          />
          {selectedCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Odabrano: <span className="font-semibold text-gray-900">{selectedCount}</span>
                {' '}({selectedTotal.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelectedIds(new Set())}
              >
                Poništi odabir
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setBulkHideConfirmOpen(true)}
              >
                <EyeOff className="w-4 h-4 mr-1" />
                Sakrij odabrane ({selectedCount})
              </Button>
            </div>
          )}
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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
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
                  <tr
                    key={invoice.id}
                    className={`hover:bg-gray-50 transition-colors ${selectedIds.has(invoice.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(invoice.id)}
                        onChange={() => toggleSelect(invoice.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                    </td>
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
        show={hideConfirmDialog.isOpen}
        onCancel={() =>
          setHideConfirmDialog({ isOpen: false, invoiceId: null, invoiceNumber: null })
        }
        onConfirm={handleHideInvoice}
        title="Sakrij račun"
        message={`Jeste li sigurni da želite sakriti račun ${hideConfirmDialog.invoiceNumber}? Račun će biti uklonjen s ove stranice, ali će ostati vidljiv u ostalim dijelovima sustava.`}
        confirmLabel="Sakrij"
        cancelLabel="Odustani"
        variant="danger"
      />

      <ConfirmDialog
        show={bulkHideConfirmOpen}
        onCancel={() => setBulkHideConfirmOpen(false)}
        onConfirm={handleBulkHide}
        title="Sakrij odabrane račune"
        message={`Jeste li sigurni da želite sakriti ${selectedCount} odabranih računa (ukupno €${selectedTotal.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})? Računi će biti uklonjeni s ove stranice, ali će ostati vidljivi u ostalim dijelovima sustava.`}
        confirmLabel={`Sakrij (${selectedCount})`}
        cancelLabel="Odustani"
        variant="danger"
      />
    </div>
  )
}

export default AccountingApprovals
