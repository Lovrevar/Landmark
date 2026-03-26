import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useToast } from '../../../contexts/ToastContext'
import { CheckCircle, EyeOff, FileText, Calendar, AlertCircle, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { ColumnMenuDropdown } from '../components/ColumnMenuDropdown'
import { useApprovals } from './hooks/useApprovals'

const COLUMN_KEYS = ['category', 'invoice_number', 'supplier_name', 'project_name', 'phase_name', 'contract_number', 'issue_date', 'due_date', 'base_amount', 'vat_amount', 'total_amount', 'status']

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
  const { t } = useTranslation()
  const toast = useToast()

  const COLUMN_LABELS: Record<string, string> = Object.fromEntries(
    COLUMN_KEYS.map(key => [key, t(`approvals.column_labels.${key}`)])
  )

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
      toast.warning(t('approvals.error_missing'))
      return
    }
    try {
      await hideInvoice(hideConfirmDialog.invoiceId)
      setHideConfirmDialog({ isOpen: false, invoiceId: null, invoiceNumber: null })
    } catch (error: unknown) {
      toast.error(t('approvals.error_hide', { error: error instanceof Error ? error.message : t('common.error') }))
    }
  }

  const handleBulkHide = async () => {
    try {
      await bulkHide()
      setBulkHideConfirmOpen(false)
    } catch (error: unknown) {
      toast.error(t('approvals.error_hide', { error: error instanceof Error ? error.message : t('common.error') }))
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('approvals.title')}
        subtitle={t('approvals.subtitle')}
        icon={CheckCircle}
      />

      <StatGrid columns={3}>
        <StatCard
          title={t('approvals.stats.pending')}
          value={stats.totalInvoices.toString()}
          icon={FileText}
          trend={stats.totalInvoices > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          title={t('approvals.stats.total_amount')}
          value={`€${stats.totalAmount.toLocaleString('hr-HR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`}
          icon={Building2}
          trend="neutral"
        />
        <StatCard
          title={t('approvals.stats.oldest')}
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
            placeholder={t('approvals.search_placeholder')}
            className="max-w-md"
          />
          <div className="flex items-center gap-3">
            {selectedCount > 0 && (
              <>
                <span className="text-sm text-gray-600">
                  {t('approvals.selected_info')} <span className="font-semibold text-gray-900">{selectedCount}</span>
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
                  {t('approvals.cancel_selection')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setBulkHideConfirmOpen(true)}
                >
                  <EyeOff className="w-4 h-4 mr-1" />
                  {t('approvals.hide_selected', { count: selectedCount })}
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
              title={t('approvals.empty.title')}
              description={t('approvals.empty.description')}
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
                  {visibleColumns.category && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.category')}</th>}
                  {visibleColumns.invoice_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.invoice_number')}</th>}
                  {visibleColumns.supplier_name && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.supplier_name')}</th>}
                  {visibleColumns.project_name && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.project_name')}</th>}
                  {visibleColumns.phase_name && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.phase_name')}</th>}
                  {visibleColumns.contract_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.contract_number')}</th>}
                  {visibleColumns.issue_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.issue_date')}</th>}
                  {visibleColumns.due_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.due_date')}</th>}
                  {visibleColumns.base_amount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.base_amount')}</th>}
                  {visibleColumns.vat_amount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.vat_amount')}</th>}
                  {visibleColumns.total_amount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.total_amount')}</th>}
                  {visibleColumns.status && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.column_labels.status')}</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('approvals.table_actions')}</th>
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
                          {invoice.is_retail ? t('approvals.category_retail') : t('approvals.category_subcontractor')}
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
                          <Badge variant="success">{t('approvals.approved_badge')}</Badge>
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
                        {t('approvals.hide_button')}
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
            title={t('approvals.no_results.title')}
            description={t('approvals.no_results.description', { term: searchTerm })}
          />
        </div>
      )}

      <ConfirmDialog
        show={hideConfirmDialog.isOpen}
        onCancel={() =>
          setHideConfirmDialog({ isOpen: false, invoiceId: null, invoiceNumber: null })
        }
        onConfirm={handleHideInvoice}
        title={t('approvals.confirm_hide.title')}
        message={t('approvals.confirm_hide.message', { number: hideConfirmDialog.invoiceNumber })}
        confirmLabel={t('approvals.confirm_hide.confirm')}
        cancelLabel={t('approvals.confirm_hide.cancel')}
        variant="danger"
      />

      <ConfirmDialog
        show={bulkHideConfirmOpen}
        onCancel={() => setBulkHideConfirmOpen(false)}
        onConfirm={handleBulkHide}
        title={t('approvals.confirm_bulk_hide.title')}
        message={t('approvals.confirm_bulk_hide.message', { count: selectedCount, total: selectedTotal.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
        confirmLabel={t('approvals.confirm_bulk_hide.confirm', { count: selectedCount })}
        cancelLabel={t('approvals.confirm_bulk_hide.cancel')}
        variant="danger"
      />
    </div>
  )
}

export default AccountingApprovals
