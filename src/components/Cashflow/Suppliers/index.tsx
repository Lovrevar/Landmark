import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Plus, DollarSign, Briefcase, TrendingUp, Trash2, Eye, Store, Link2, Pencil } from 'lucide-react'
import RetailSupplierModal from './forms/RetailSupplierModal'
import SupplierFormModal from './forms/SupplierFormModal'
import SupplierDetailsModal from './modals/SupplierDetailsModal'
import SupplierCard from './SupplierCard'
import { LinkSupplierToProjectModal } from './forms/LinkSupplierToProjectModal'
import { useSuppliers } from './hooks/useSuppliers'
import { useListPreferences } from '../../../hooks/useListPreferences'
import { formatEuropean } from '../../../utils/formatters'
import { SupplierSummary } from './types'
import {
  PageHeader, StatGrid, LoadingSpinner, SearchInput, Button, StatCard, EmptyState, Badge,
  ConfirmDialog, Table, FilterBar, FilterChip, ListViewToggle, SortDropdown,
} from '../../ui'
import type { ListViewMode } from '../../ui'

type StatusFilter = 'all' | 'active' | 'paid' | 'outstanding' | 'no_contracts'
type SourceFilter = 'all' | 'site' | 'retail'
type SortKey = 'name' | 'remaining' | 'value' | 'paid'

interface ListPrefs {
  viewMode: ListViewMode
  sort: SortKey
  statusFilter: StatusFilter
  sourceFilter: SourceFilter
  projectFilter: string
}

const DEFAULT_PREFS: ListPrefs = { viewMode: 'cards', sort: 'name', statusFilter: 'all', sourceFilter: 'all', projectFilter: '' }

const AccountingSuppliers: React.FC = () => {
  const { t } = useTranslation()
  const {
    suppliers,
    loading,
    showAddModal,
    showDetailsModal,
    selectedSupplier,
    editingSupplier,
    showRetailModal,
    setShowRetailModal,
    showLinkModal,
    formData,
    setFormData,
    projects,
    phases,
    loadingProjects,
    fetchData,
    handleOpenAddModal,
    handleCloseAddModal,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteSupplier,
    deleting,
    handleViewDetails,
    handleCloseDetailsModal,
    handleOpenLinkModal,
    handleCloseLinkModal
  } = useSuppliers()

  const [searchTerm, setSearchTerm] = useState('')
  const [prefs, setPrefs] = useListPreferences<ListPrefs>('suppliers.prefs', DEFAULT_PREFS)

  const availableProjects = useMemo(() => {
    const set = new Set<string>()
    suppliers.forEach(s => s.project_names.forEach(p => set.add(p)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [suppliers])

  const matchesStatus = (s: SupplierSummary): boolean => {
    switch (prefs.statusFilter) {
      case 'active': return s.total_contracts > 0
      case 'paid': return s.total_contract_value > 0 && s.total_remaining <= 0
      case 'outstanding': return s.total_remaining > 0
      case 'no_contracts': return s.total_contracts === 0
      default: return true
    }
  }

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase()
    const list = suppliers.filter(s =>
      (s.name.toLowerCase().includes(term) || s.contact.toLowerCase().includes(term)) &&
      matchesStatus(s) &&
      (prefs.sourceFilter === 'all' || s.source === prefs.sourceFilter) &&
      (!prefs.projectFilter || s.project_names.includes(prefs.projectFilter))
    )
    const sorted = [...list]
    switch (prefs.sort) {
      case 'remaining': sorted.sort((a, b) => b.total_remaining - a.total_remaining); break
      case 'value': sorted.sort((a, b) => b.total_contract_value - a.total_contract_value); break
      case 'paid': sorted.sort((a, b) => b.total_paid - a.total_paid); break
      default: sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, searchTerm, prefs.statusFilter, prefs.sourceFilter, prefs.projectFilter, prefs.sort])

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: t('common.filter_active') },
    { value: 'outstanding', label: t('common.filter_outstanding') },
    { value: 'paid', label: t('common.filter_paid') },
    { value: 'no_contracts', label: t('common.filter_no_contracts') },
  ]

  const sourceChips: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'site', label: t('suppliers.source_site') },
    { value: 'retail', label: t('suppliers.source_retail') },
  ]

  const sortOptions = [
    { value: 'name' as SortKey, label: t('common.sort_name') },
    { value: 'remaining' as SortKey, label: t('common.sort_remaining') },
    { value: 'value' as SortKey, label: t('common.sort_value') },
    { value: 'paid' as SortKey, label: t('common.sort_paid') },
  ]

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('suppliers.title')}
        description={t('suppliers.subtitle')}
        actions={
          <>
            <Button variant="secondary" icon={Link2} onClick={handleOpenLinkModal}>
              {t('suppliers.link_supplier')}
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => handleOpenAddModal()}>
              {t('suppliers.add_new')}
            </Button>
            <Button variant="primary" icon={Store} onClick={() => setShowRetailModal(true)} className="bg-teal-600 hover:bg-teal-700">
              {t('suppliers.add_retail')}
            </Button>
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard label={t('suppliers.stats.total_count')} value={suppliers.length} icon={Users} />
        <StatCard label={t('suppliers.stats.total_contracts')} value={suppliers.reduce((sum, s) => sum + s.total_contracts, 0)} icon={Briefcase} color="gray" />
        <StatCard label={t('suppliers.stats.total_paid')} value={`€${formatEuropean(suppliers.reduce((sum, s) => sum + s.total_paid, 0))}`} icon={DollarSign} color="green" />
        <StatCard label={t('suppliers.stats.total_remaining')} value={`€${formatEuropean(suppliers.reduce((sum, s) => sum + s.total_remaining, 0))}`} icon={TrendingUp} color="yellow" />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('suppliers.search')}
        />
        <FilterBar className="justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 mr-2">
              {sourceChips.map(chip => (
                <FilterChip
                  key={chip.value}
                  size="sm"
                  active={prefs.sourceFilter === chip.value}
                  onClick={() => setPrefs({ sourceFilter: chip.value })}
                >
                  {chip.label}
                </FilterChip>
              ))}
            </div>
            {statusChips.map(chip => (
              <FilterChip
                key={chip.value}
                size="sm"
                active={prefs.statusFilter === chip.value}
                onClick={() => setPrefs({ statusFilter: prefs.statusFilter === chip.value ? 'all' : chip.value })}
              >
                {chip.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t('common.project')}
              value={prefs.projectFilter}
              onChange={(e) => setPrefs({ projectFilter: e.target.value })}
              className="py-1.5 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
            >
              <option value="">{t('common.all_projects')}</option>
              {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <SortDropdown value={prefs.sort} options={sortOptions} onChange={(v) => setPrefs({ sort: v })} />
            <ListViewToggle
              value={prefs.viewMode}
              onChange={(v) => setPrefs({ viewMode: v })}
              cardsLabel={t('common.view_cards')}
              tableLabel={t('common.view_table')}
              size="sm"
            />
          </div>
        </FilterBar>
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={Users}
            title={searchTerm ? t('common.no_results') : t('suppliers.no_suppliers')}
            description={searchTerm ? t('suppliers.no_results_hint') : t('suppliers.no_suppliers_hint')}
          />
        </div>
      ) : prefs.viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSuppliers.map(supplier => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onSelect={() => handleViewDetails(supplier)}
              onEdit={(e) => { e.stopPropagation(); handleOpenAddModal(supplier) }}
              onDelete={(e) => { e.stopPropagation(); handleDelete(supplier) }}
            />
          ))}
        </div>
      ) : (
        <Table dense fitContent className="md:w-fit max-w-full">
          <Table.Head>
            <Table.Tr hoverable={false}>
              <Table.Th>{t('common.name')}</Table.Th>
              <Table.Th>{t('suppliers.source_label')}</Table.Th>
              <Table.Th>{t('common.contact')}</Table.Th>
              <Table.Th>{t('suppliers.stats.total_contracts')}</Table.Th>
              <Table.Th>{t('suppliers.invoices_label')}</Table.Th>
              <Table.Th className="text-right">{t('common.value')}</Table.Th>
              <Table.Th className="text-right">{t('common.total_paid')}</Table.Th>
              <Table.Th className="text-right">{t('common.remaining')}</Table.Th>
              <Table.Th sticky className="text-right">{t('common.actions')}</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredSuppliers.map(supplier => (
              <Table.Tr key={supplier.id} className="cursor-pointer" onClick={() => handleViewDetails(supplier)}>
                <Table.Td label={t('common.name')} className="font-medium">{supplier.name}</Table.Td>
                <Table.Td label={t('suppliers.source_label')}>
                  <Badge variant={supplier.source === 'retail' ? 'teal' : 'blue'} size="sm">
                    {supplier.source === 'retail' ? t('suppliers.source_retail') : t('suppliers.source_site')}
                  </Badge>
                </Table.Td>
                <Table.Td label={t('common.contact')} className="text-gray-500 dark:text-gray-400">{supplier.contact || '-'}</Table.Td>
                <Table.Td label={t('suppliers.stats.total_contracts')}>{supplier.total_contracts}</Table.Td>
                <Table.Td label={t('suppliers.invoices_label')}>{supplier.total_invoices}</Table.Td>
                <Table.Td label={t('common.value')} className="text-right font-semibold">€{formatEuropean(supplier.total_contract_value)}</Table.Td>
                <Table.Td label={t('common.total_paid')} className="text-right text-green-600">€{formatEuropean(supplier.total_paid)}</Table.Td>
                <Table.Td label={t('common.remaining')} className="text-right text-orange-600">€{formatEuropean(supplier.total_remaining)}</Table.Td>
                <Table.Td sticky className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-1">
                    {supplier.source === 'site' && (
                      <Button variant="ghost" size="icon-sm" icon={Pencil} title={t('common.edit')} onClick={() => handleOpenAddModal(supplier)} />
                    )}
                    <Button variant="outline-danger" size="icon-sm" icon={Trash2} title={t('common.delete')} onClick={() => handleDelete(supplier)} />
                    <Eye className="w-4 h-4 text-blue-600" />
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

      <SupplierFormModal
        showModal={showAddModal}
        editingSupplier={editingSupplier}
        formData={formData}
        setFormData={setFormData}
        projects={projects}
        phases={phases}
        loadingProjects={loadingProjects}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmit}
      />

      <SupplierDetailsModal
        showModal={showDetailsModal}
        supplier={selectedSupplier}
        onClose={handleCloseDetailsModal}
      />

      {showRetailModal && (
        <RetailSupplierModal
          onClose={() => setShowRetailModal(false)}
          onSuccess={() => {
            setShowRetailModal(false)
            fetchData()
          }}
        />
      )}

      <LinkSupplierToProjectModal
        visible={showLinkModal}
        onClose={handleCloseLinkModal}
        onSuccess={() => {
          handleCloseLinkModal()
          fetchData()
        }}
      />

      <ConfirmDialog
        show={!!pendingDeleteSupplier}
        title={t('confirm.delete_title')}
        message={t('suppliers.confirm_delete_message')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default AccountingSuppliers
