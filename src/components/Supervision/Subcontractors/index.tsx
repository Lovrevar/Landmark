import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Plus, Briefcase, DollarSign, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import {
  LoadingSpinner, PageHeader, Card, Modal, EmptyState, StatCard, StatGrid,
  SearchInput, Button, ConfirmDialog, Table, FilterBar, FilterChip,
  ListViewToggle, SortDropdown,
} from '../../ui'
import type { ListViewMode } from '../../ui'
import { formatEuropean } from '../../../utils/formatters'
import { useListPreferences } from '../../../hooks/useListPreferences'
import { useSubcontractorData } from './hooks/useSubcontractorData'
import { SubcontractorCard } from './SubcontractorCard'
import { SubcontractorContractsList } from './SubcontractorContractsList'
import { SubcontractorDocumentsSection } from './SubcontractorDocumentsSection'
import { SubcontractorBasicFormModal } from './forms/SubcontractorBasicFormModal'
import { ContractDocumentViewer } from '../SiteManagement/ContractDocumentViewer'
import { SubcontractorSummary, SubcontractorContract } from './types'
import { useToast } from '../../../contexts/ToastContext'

type StatusFilter = 'all' | 'active' | 'paid' | 'outstanding' | 'no_contracts'
type SortKey = 'name' | 'remaining' | 'value' | 'paid'

interface ListPrefs {
  viewMode: ListViewMode
  sort: SortKey
  statusFilter: StatusFilter
  projectFilter: string
}

const DEFAULT_PREFS: ListPrefs = { viewMode: 'cards', sort: 'name', statusFilter: 'all', projectFilter: '' }

const paymentPct = (sub: SubcontractorSummary) =>
  sub.total_contract_value > 0 ? (sub.total_paid / sub.total_contract_value) * 100 : 0

const SubcontractorManagement: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { subcontractors, loading, fetchData, deleteSubcontractor } = useSubcontractorData()
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<SubcontractorSummary | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [prefs, setPrefs] = useListPreferences<ListPrefs>('subcontractors.prefs', DEFAULT_PREFS)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<{ id: string; name: string; contact: string; notes?: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({ show: false, id: '', name: '' })
  const [viewingContractDocuments, setViewingContractDocuments] = useState<{ subcontractorId: string; contractId: string; label: string } | null>(null)

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    document.body.style.overflow = selectedSubcontractor ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [selectedSubcontractor])

  const handleDelete = async () => {
    try {
      await deleteSubcontractor(deleteConfirm.id)
      setDeleteConfirm({ show: false, id: '', name: '' })
      fetchData()
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
      toast.error(t('supervision.subcontractors.failed_delete'))
    }
  }

  const handleViewDocuments = (contract: SubcontractorContract) => {
    setViewingContractDocuments({
      subcontractorId: selectedSubcontractor!.id,
      contractId: contract.id,
      label: `${contract.project_name}${contract.phase_name ? ` · ${contract.phase_name}` : ''}`
    })
  }

  const subcontractorsList = useMemo(() => Array.from(subcontractors.values()), [subcontractors])

  const availableProjects = useMemo(() => {
    const set = new Set<string>()
    subcontractorsList.forEach(sub => sub.contracts.forEach(c => { if (c.project_name) set.add(c.project_name) }))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [subcontractorsList])

  const matchesStatus = (sub: SubcontractorSummary): boolean => {
    switch (prefs.statusFilter) {
      case 'active': return sub.active_contracts > 0
      case 'paid': return sub.total_contract_value > 0 && sub.total_remaining <= 0
      case 'outstanding': return sub.total_remaining > 0
      case 'no_contracts': return sub.total_contracts === 0
      default: return true
    }
  }

  const filteredSubcontractors = useMemo(() => {
    const term = searchTerm.toLowerCase()
    const list = subcontractorsList.filter(sub =>
      (sub.name.toLowerCase().includes(term) || sub.contact.toLowerCase().includes(term)) &&
      matchesStatus(sub) &&
      (!prefs.projectFilter || sub.contracts.some(c => c.project_name === prefs.projectFilter))
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
  }, [subcontractorsList, searchTerm, prefs.statusFilter, prefs.projectFilter, prefs.sort])

  const isFiltered = !!searchTerm || prefs.statusFilter !== 'all' || !!prefs.projectFilter
  const displayCount = isFiltered
    ? `${filteredSubcontractors.length} / ${subcontractorsList.length}`
    : subcontractorsList.length

  const totals = useMemo(() => subcontractorsList.reduce((acc, s) => {
    acc.active += s.active_contracts
    acc.paid += s.total_paid
    acc.remaining += s.total_remaining
    return acc
  }, { active: 0, paid: 0, remaining: 0 }), [subcontractorsList])

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: t('common.filter_active') },
    { value: 'outstanding', label: t('common.filter_outstanding') },
    { value: 'paid', label: t('common.filter_paid') },
    { value: 'no_contracts', label: t('common.filter_no_contracts') },
  ]

  const sortOptions = [
    { value: 'name' as SortKey, label: t('common.sort_name') },
    { value: 'remaining' as SortKey, label: t('common.sort_remaining') },
    { value: 'value' as SortKey, label: t('common.sort_value') },
    { value: 'paid' as SortKey, label: t('common.sort_paid') },
  ]

  if (loading) return <LoadingSpinner message={t('supervision.subcontractors.loading')} />

  const openEdit = (sub: SubcontractorSummary) => {
    setEditingSubcontractor({ id: sub.id, name: sub.name, contact: sub.contact, notes: sub.notes })
    setShowFormModal(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('supervision.subcontractors.title')}
        description={t('supervision.subcontractors.subtitle')}
        actions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">{isFiltered ? t('supervision.subcontractors.showing') : t('supervision.subcontractors.total')} {t('common.subcontractors')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{displayCount}</p>
            </div>
            <Button onClick={() => { setEditingSubcontractor(null); setShowFormModal(true) }} icon={Plus}>
              {t('supervision.subcontractors.add')}
            </Button>
          </div>
        }
      />

      <StatGrid columns={4}>
        <StatCard label={t('supervision.subcontractors.title')} value={subcontractorsList.length} icon={Users} />
        <StatCard label={t('supervision.subcontractors.active_contracts')} value={totals.active} icon={Briefcase} color="blue" />
        <StatCard label={t('common.total_paid')} value={`€${formatEuropean(totals.paid)}`} icon={DollarSign} color="teal" />
        <StatCard label={t('common.remaining')} value={`€${formatEuropean(totals.remaining)}`} icon={TrendingUp} color="yellow" />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('supervision.subcontractors.search_placeholder')}
        />
        <FilterBar className="justify-between">
          <div className="flex flex-wrap items-center gap-2">
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

      {subcontractorsList.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState icon={Users} title={t('supervision.subcontractors.none')} description={t('supervision.subcontractors.none_desc')} />
        </Card>
      ) : filteredSubcontractors.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState icon={Users} title={t('supervision.subcontractors.no_match')} description={t('supervision.subcontractors.no_match_desc')} />
        </Card>
      ) : prefs.viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSubcontractors.map((sub) => (
            <SubcontractorCard
              key={sub.id}
              sub={sub}
              onSelect={() => setSelectedSubcontractor(sub)}
              onEdit={(e) => { e.stopPropagation(); openEdit(sub) }}
              onDelete={(e) => { e.stopPropagation(); setDeleteConfirm({ show: true, id: sub.id, name: sub.name }) }}
            />
          ))}
        </div>
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr hoverable={false}>
              <Table.Th>{t('common.name')}</Table.Th>
              <Table.Th>{t('common.contact')}</Table.Th>
              <Table.Th>{t('supervision.subcontractors.total_contracts')}</Table.Th>
              <Table.Th className="text-right">{t('supervision.subcontractors.contract_value')}</Table.Th>
              <Table.Th className="text-right">{t('common.total_paid')}</Table.Th>
              <Table.Th className="text-right">{t('common.remaining')}</Table.Th>
              <Table.Th>{t('supervision.subcontractors.payment_progress')}</Table.Th>
              <Table.Th sticky className="text-right">{t('common.actions')}</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredSubcontractors.map((sub) => {
              const pct = paymentPct(sub)
              return (
                <Table.Tr key={sub.id} className="cursor-pointer" onClick={() => setSelectedSubcontractor(sub)}>
                  <Table.Td label={t('common.name')} className="font-medium">{sub.name}</Table.Td>
                  <Table.Td label={t('common.contact')} className="text-gray-500 dark:text-gray-400">{sub.contact || '-'}</Table.Td>
                  <Table.Td label={t('supervision.subcontractors.total_contracts')}>{sub.total_contracts} ({sub.active_contracts})</Table.Td>
                  <Table.Td label={t('supervision.subcontractors.contract_value')} className="text-right font-semibold">€{formatEuropean(sub.total_contract_value)}</Table.Td>
                  <Table.Td label={t('common.total_paid')} className="text-right text-teal-600">€{formatEuropean(sub.total_paid)}</Table.Td>
                  <Table.Td label={t('common.remaining')} className="text-right text-orange-600">€{formatEuropean(sub.total_remaining)}</Table.Td>
                  <Table.Td label={t('supervision.subcontractors.payment_progress')}>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-xs w-9 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </Table.Td>
                  <Table.Td sticky className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" icon={Pencil} title={t('supervision.subcontractors.edit')} onClick={() => openEdit(sub)} />
                      <Button variant="outline-danger" size="icon-sm" icon={Trash2} title={t('supervision.subcontractors.delete_title')} onClick={() => setDeleteConfirm({ show: true, id: sub.id, name: sub.name })} />
                    </div>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Body>
        </Table>
      )}

      <SubcontractorBasicFormModal
        visible={showFormModal}
        onClose={() => setShowFormModal(false)}
        editingId={editingSubcontractor?.id ?? null}
        initialData={{ name: editingSubcontractor?.name ?? '', contact: editingSubcontractor?.contact ?? '', notes: editingSubcontractor?.notes ?? '' }}
        onSaved={fetchData}
      />

      <Modal show={!!selectedSubcontractor} onClose={() => setSelectedSubcontractor(null)} size="xl">
        {selectedSubcontractor && (
          <>
            <Modal.Header
              title={selectedSubcontractor.name}
              subtitle={selectedSubcontractor.contact}
              onClose={() => setSelectedSubcontractor(null)}
            />
            <Modal.Body>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label={t('supervision.subcontractors.total_contracts')} value={selectedSubcontractor.total_contracts} color="blue" />
                <StatCard label={t('supervision.subcontractors.contract_value')} value={`€${formatEuropean(selectedSubcontractor.total_contract_value)}`} color="gray" />
                <StatCard label={t('common.total_paid')} value={`€${formatEuropean(selectedSubcontractor.total_paid)}`} color="teal" />
                <StatCard label={t('common.remaining')} value={`€${formatEuropean(selectedSubcontractor.total_remaining)}`} color="yellow" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('supervision.subcontractors.all_contracts')}</h3>
              <SubcontractorContractsList
                contracts={selectedSubcontractor.contracts}
                onViewDocuments={handleViewDocuments}
              />

              <SubcontractorDocumentsSection subcontractorId={selectedSubcontractor.id} />
            </Modal.Body>
          </>
        )}
      </Modal>

      <Modal show={!!viewingContractDocuments} onClose={() => setViewingContractDocuments(null)} size="md">
        {viewingContractDocuments && (
          <>
            <Modal.Header
              title={t('common.contract_documents')}
              subtitle={viewingContractDocuments.label}
              onClose={() => setViewingContractDocuments(null)}
            />
            <Modal.Body>
              <ContractDocumentViewer
                subcontractorId={viewingContractDocuments.subcontractorId}
                contractId={viewingContractDocuments.contractId}
                readOnly
              />
            </Modal.Body>
          </>
        )}
      </Modal>

      <ConfirmDialog
        show={deleteConfirm.show}
        title={t('supervision.subcontractors.delete_title')}
        message={t('supervision.subcontractors.delete_message')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: '', name: '' })}
      />
    </div>
  )
}

export default SubcontractorManagement
