import React, { useState, useEffect } from 'react'
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
} from '../../ui'
import { CheckCircle, EyeOff, FileText, Calendar, AlertCircle, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { ColumnMenuDropdown } from '../Components/ColumnMenuDropdown'
import { useApprovals } from './hooks/useApprovals'

const COLUMN_LABELS: Record<string, string> = {
  category: 'Kategorija',
  invoice_number: 'Broj računa',
  supplier_name: 'Dobavljač',
  project_name: 'Projekt',
  phase_name: 'Faza',
  contract_number: 'Ugovor',
  issue_date: 'Datum izdavanja',
  due_date: 'Dospijeće',
  base_amount: 'Osnovica',
  vat_amount: 'PDV',
  total_amount: 'Ukupno',
  status: 'Status',
}

const DEFAULT_VISIBLE: Record<string, boolean> = {
  category: true,
  invoice_number: true,
  supplier_name: true,
  project_name: true,
  phase_name: true,
  contract_number: false,
  issue_date: true,
  due_date: true,
  base_amount: true,
  vat_amount: true,
  total_amount: true,
  status: true,
}

const AccountingApprovals: React.FC = () => {
  const {
    invoices,
    filteredInvoices,
    stats,
    loading,
    searchTerm,
    setSearchTerm,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allFilteredSelected,
    selectedCount,
    selectedTotal,
    hideInvoice,
    bulkHide
  } = useApprovals()

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(DEFAULT_VISIBLE)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
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

  useEffect(() => {
    if (!showColumnMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.column-menu-container')) setShowColumnMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColumnMenu])

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }))
  }

  const handleHideInvoice = async () => {
    if (!hideConfirmDialog.invoiceId) {
      alert('Greška: Korisnik ili ID računa nisu pronađeni.')
      return
    }
    try {
      await hideInvoice(hideConfirmDialog.invoiceId)
      setHideConfirmDialog({ isOpen: false, invoiceId: null, invoiceNumber: null })
    } catch (error: unknown) {
      alert(`Došlo je do greške pri skrivanju računa: ${error instanceof Error ? error.message : 'Nepoznata greška'}`)
    }
  }

  const handleBulkHide = async () => {
    try {
      await bulkHide()
      setBulkHideConfirmOpen(false)
    } catch (error: unknown) {
      alert(`Došlo je do greške pri skrivanju računa: ${error instanceof Error ? error.message : 'Nepoznata greška'}`)
    }
  }

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
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pretraži račune..."
            className="max-w-md"
          />
          <div className="flex items-center gap-3">
            {selectedCount > 0 && (
              <>
                <span className="text-sm text-gray-600">
                  Odabrano: <span className="font-semibold text-gray-900">{selectedCount}</span>
                  {' '}({selectedTotal.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    filteredInvoices.forEach(inv => {
                      if (selectedIds.has(inv.id)) toggleSelect(inv.id)
                    })
                    Array.from(selectedIds).forEach(id => toggleSelect(id))
                  }}
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
              </>
            )}
            <ColumnMenuDropdown
              showColumnMenu={showColumnMenu}
              visibleColumns={visibleColumns}
              columnLabels={COLUMN_LABELS}
              onToggleMenu={() => setShowColumnMenu((v) => !v)}
              onToggleColumn={toggleColumn}
            />
          </div>
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
                  {visibleColumns.category && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Kategorija</th>}
                  {visibleColumns.invoice_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Broj računa</th>}
                  {visibleColumns.supplier_name && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Dobavljač</th>}
                  {visibleColumns.project_name && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Projekt</th>}
                  {visibleColumns.phase_name && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Faza</th>}
                  {visibleColumns.contract_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ugovor</th>}
                  {visibleColumns.issue_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Datum izdavanja</th>}
                  {visibleColumns.due_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Dospijeće</th>}
                  {visibleColumns.base_amount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Osnovica</th>}
                  {visibleColumns.vat_amount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PDV</th>}
                  {visibleColumns.total_amount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ukupno</th>}
                  {visibleColumns.status && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>}
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
                    {visibleColumns.category && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge variant={invoice.is_retail ? 'teal' : 'blue'} size="sm">
                          {invoice.is_retail ? 'Retail' : 'Podizvodjač'}
                        </Badge>
                      </td>
                    )}
                    {visibleColumns.invoice_number && <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.invoice_number}</td>}
                    {visibleColumns.supplier_name && <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{invoice.supplier_name}</td>}
                    {visibleColumns.project_name && <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{invoice.project_name}</td>}
                    {visibleColumns.phase_name && <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{invoice.phase_name}</td>}
                    {visibleColumns.contract_number && <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{invoice.contract_number}</td>}
                    {visibleColumns.issue_date && <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</td>}
                    {visibleColumns.due_date && <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{format(new Date(invoice.due_date), 'dd.MM.yyyy')}</td>}
                    {visibleColumns.base_amount && (
                      <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">
                        €{invoice.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {visibleColumns.vat_amount && (
                      <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">
                        €{invoice.vat_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {visibleColumns.total_amount && (
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                        €{invoice.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'UNPAID' ? 'warning' : 'default'}>
                            {invoice.status}
                          </Badge>
                          <Badge variant="success">Odobreno</Badge>
                        </div>
                      </td>
                    )}
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
