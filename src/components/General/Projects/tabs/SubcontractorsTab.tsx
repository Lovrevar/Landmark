import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, ChevronUp, ChevronDown } from 'lucide-react'
import { Badge, Button, EmptyState, Select, SearchInput, StatCard, StatGrid, Table } from '../../../ui'
import type { Phase, ContractWithDetails } from '../types'

interface SubcontractorsTabProps {
  contracts: ContractWithDetails[]
  phases: Phase[]
  projectId?: string
}

type SortKey = 'name' | 'phase' | 'contract_amount' | 'realized' | 'remaining' | 'status'
type SortDir = 'asc' | 'desc'

const NO_PHASE = '__none'
const formatEur = (n: number) => `€${n.toLocaleString('hr-HR')}`
const remainingOf = (c: ContractWithDetails) => c.contract_amount - c.budget_realized

const statusVariant = (status: string): 'green' | 'gray' | 'yellow' =>
  status === 'active' ? 'green' : status === 'completed' ? 'gray' : 'yellow'

const SubcontractorsTab: React.FC<SubcontractorsTabProps> = ({ contracts, phases }) => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const statusOptions = useMemo(
    () => Array.from(new Set(contracts.map(c => c.status).filter(Boolean))).sort(),
    [contracts]
  )

  const hasUnphased = useMemo(() => contracts.some(c => !c.phase?.phase_name), [contracts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contracts.filter(c => {
      if (q && !c.subcontractor.name.toLowerCase().includes(q)) return false
      if (phaseFilter !== 'all') {
        const name = c.phase?.phase_name
        if (phaseFilter === NO_PHASE ? !!name : name !== phaseFilter) return false
      }
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
  }, [contracts, search, phaseFilter, statusFilter])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const value = (c: ContractWithDetails): string | number => {
      switch (sortKey) {
        case 'name': return c.subcontractor.name
        case 'phase': return c.phase?.phase_name ?? ''
        case 'contract_amount': return c.contract_amount
        case 'realized': return c.budget_realized
        case 'remaining': return remainingOf(c)
        case 'status': return c.status
      }
    }
    return [...filtered].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      if (cmp !== 0) return cmp * dir
      return a.subcontractor.name.localeCompare(b.subcontractor.name)
    })
  }, [filtered, sortKey, sortDir])

  const summary = useMemo(() => {
    const totalValue = filtered.reduce((s, c) => s + Number(c.contract_amount || 0), 0)
    const totalRealized = filtered.reduce((s, c) => s + Number(c.budget_realized || 0), 0)
    return { totalValue, totalRealized, totalRemaining: totalValue - totalRealized, count: filtered.length }
  }, [filtered])

  const statusLabel = (s: string) => t(`status.${s}`, s)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const clearFilters = () => {
    setSearch('')
    setPhaseFilter('all')
    setStatusFilter('all')
  }

  const SortableTh: React.FC<{ sortKey: SortKey; children: React.ReactNode }> = ({ sortKey: key, children }) => (
    <Table.Th sortable onClick={() => toggleSort(key)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === key && (
          sortDir === 'asc'
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
        )}
      </span>
    </Table.Th>
  )

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.subcontractors_contracts')}</h3>

      {contracts.length === 0 ? (
        <EmptyState icon={Users} title={t('general_projects.no_contracts')} />
      ) : (
        <>
          <StatGrid columns={4}>
            <StatCard label={t('general_projects.total_contract_value')} value={formatEur(summary.totalValue)} color="blue" />
            <StatCard label={t('general_projects.total_realized')} value={formatEur(summary.totalRealized)} color="teal" />
            <StatCard label={t('general_projects.total_remaining')} value={formatEur(summary.totalRemaining)} color="green" />
            <StatCard label={t('general_projects.contract_count')} value={summary.count} color="gray" />
          </StatGrid>

          <div className="flex flex-col md:flex-row gap-4">
            <SearchInput
              className="flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder={t('general_projects.search_subcontractors')}
            />
            <Select className="md:w-56" value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
              <option value="all">{t('common.all')}</option>
              {phases.map(p => (
                <option key={p.id} value={p.phase_name}>{p.phase_name}</option>
              ))}
              {hasUnphased && (
                <option value={NO_PHASE}>{t('general_projects.milestone_template.no_phase_label')}</option>
              )}
            </Select>
            <Select className="md:w-56" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('general_projects.all_statuses')}</option>
              {statusOptions.map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </Select>
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('general_projects.no_contracts')}
              description={t('general_projects.no_contracts_match_filters')}
              action={<Button variant="secondary" onClick={clearFilters}>{t('common.clear_filters')}</Button>}
            />
          ) : (
            <Table>
              <Table.Head>
                <Table.Tr>
                  <SortableTh sortKey="name">{t('common.subcontractor')}</SortableTh>
                  <SortableTh sortKey="phase">{t('common.phase')}</SortableTh>
                  <SortableTh sortKey="contract_amount">{t('general_projects.contract_amount')}</SortableTh>
                  <SortableTh sortKey="realized">{t('general_projects.realized')}</SortableTh>
                  <SortableTh sortKey="remaining">{t('common.remaining')}</SortableTh>
                  <SortableTh sortKey="status">{t('common.status')}</SortableTh>
                  <Table.Th>{t('general_projects.contact')}</Table.Th>
                </Table.Tr>
              </Table.Head>
              <Table.Body>
                {sorted.map((contract) => (
                  <Table.Tr key={contract.id}>
                    <Table.Td label={t('common.subcontractor')} className="font-medium text-gray-900 dark:text-white">
                      {contract.subcontractor.name}
                    </Table.Td>
                    <Table.Td label={t('common.phase')}>{contract.phase?.phase_name ?? '-'}</Table.Td>
                    <Table.Td label={t('general_projects.contract_amount')} className="font-semibold">
                      {formatEur(contract.contract_amount)}
                    </Table.Td>
                    <Table.Td label={t('general_projects.realized')} className="text-blue-600">
                      {formatEur(contract.budget_realized)}
                    </Table.Td>
                    <Table.Td label={t('common.remaining')} className="text-green-600">
                      {formatEur(remainingOf(contract))}
                    </Table.Td>
                    <Table.Td label={t('common.status')}>
                      <Badge variant={statusVariant(contract.status)} size="sm">{statusLabel(contract.status)}</Badge>
                    </Table.Td>
                    <Table.Td label={t('general_projects.contact')}>{contract.subcontractor.contact || '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Body>
            </Table>
          )}
        </>
      )}
    </div>
  )
}

export default SubcontractorsTab
