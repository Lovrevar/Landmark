import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Briefcase, ChevronDown } from 'lucide-react'
import { EmptyState, Table } from '../../../ui'
import { usePhaseCollapseState } from '../hooks/usePhaseCollapseState'
import { formatEuroRounded as money } from '../../../../utils/formatters'
// The label helper and the classification sort come from Site Management on purpose. This tab is
// a second window onto the same phases and contracts, and the two disagreeing on a phase's name
// or on the order of its cost classifications is exactly the confusion the split was meant to end.
import { formatPhaseLabel } from '../../../Supervision/SiteManagement/utils/phaseLabel'
import type { PhaseStatus } from '../utils'
import type { Phase, ContractWithDetails } from '../types'

interface PhasesContractsTabProps {
  phases: Phase[]
  contracts: ContractWithDetails[]
  projectId?: string
  /** The project's TIC total; null means it has no plan, so no budget figure is meaningful. */
  ticTotal: number | null
  /** Invoice-derived paid/owed per contract id, the same source Site Management uses. */
  invoiceStats: Map<string, { totalPaid: number; totalOwed: number }>
}

interface ClassificationGroup {
  key: string
  name: string
  sortKey: number
  contracts: ContractWithDetails[]
  contracted: number
  paid: number
}

const PhasesContractsTab: React.FC<PhasesContractsTabProps> = ({
  phases,
  contracts,
  projectId,
  ticTotal,
  invoiceStats,
}) => {
  const { t } = useTranslation()

  // Paid comes from invoices, never from `contracts.budget_realized`. The two disagree — on Zona
  // 31 by €25.000 — and the invoice figure is the one every phase card and the contract tree in
  // Site Management shows. A second screen quoting the other number is how a project ends up with
  // two "total paid" values that are both defended as correct.
  const paidFor = useMemo(
    () => (contract: ContractWithDetails) => invoiceStats.get(contract.id)?.totalPaid ?? 0,
    [invoiceStats]
  )

  // Keyed by phase_id, not phase_name. Names are not unique — every project now has a phase
  // called "Faza 1" — so a name-keyed map merged distinct phases into one bucket.
  const contractsByPhase = useMemo(() => {
    const map = new Map<string, ContractWithDetails[]>()
    for (const c of contracts) {
      const key = c.phase_id
      if (!key) continue
      const bucket = map.get(key)
      if (bucket) bucket.push(c)
      else map.set(key, [c])
    }
    return map
  }, [contracts])

  // Contracts sit under their cost classification inside the phase, mirroring the nesting of the
  // "by phase" view in Site Management. Unclassified rows sort last rather than alphabetically:
  // they are a gap to fill, not a category.
  const groupByClassification = useMemo(
    () => (phaseContracts: ContractWithDetails[]): ClassificationGroup[] => {
      const groups = new Map<string, ClassificationGroup>()
      for (const c of phaseContracts) {
        const id = c.classification?.id ?? null
        const key = id === null ? 'none' : String(id)
        let group = groups.get(key)
        if (!group) {
          group = {
            key,
            name: c.classification?.name ?? t('supervision.site_management.phase_card.unclassified'),
            sortKey: id === null ? Number.MAX_SAFE_INTEGER : (c.classification?.sort_order ?? 0),
            contracts: [],
            contracted: 0,
            paid: 0,
          }
          groups.set(key, group)
        }
        group.contracts.push(c)
        group.contracted += Number(c.contract_amount || 0)
        group.paid += paidFor(c)
      }
      return [...groups.values()].sort((a, b) => a.sortKey - b.sortKey)
    },
    [t, paidFor]
  )

  const phaseStatuses = useMemo<PhaseStatus[]>(
    () => phases.map(p => ({
      key: p.id,
      total: contractsByPhase.get(p.id)?.length ?? 0,
      completed: 0,
      overdue: 0,
    })),
    [phases, contractsByPhase]
  )

  const collapse = usePhaseCollapseState(projectId, phaseStatuses, 'phase_contracts_collapse_v2')

  const hasPlan = ticTotal !== null && ticTotal > 0

  const renderContracts = (phaseContracts: ContractWithDetails[]) => (
    <div className="space-y-4">
      {groupByClassification(phaseContracts).map(group => (
        <div key={group.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {group.name}
            </h5>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {money(group.contracted)} · {t('common.paid').toLowerCase()} {money(group.paid)}
            </span>
          </div>
          <Table dense>
            <Table.Head>
              <Table.Tr>
                <Table.Th>{t('common.subcontractor')}</Table.Th>
                <Table.Th>{t('general_projects.job_description')}</Table.Th>
                <Table.Th>{t('general_projects.contract_amount')}</Table.Th>
                <Table.Th>{t('common.paid')}</Table.Th>
              </Table.Tr>
            </Table.Head>
            <Table.Body>
              {group.contracts.map(contract => (
                <Table.Tr key={contract.id}>
                  <Table.Td label={t('common.subcontractor')} className="font-medium text-gray-900 dark:text-white">
                    {contract.subcontractor.name}
                  </Table.Td>
                  <Table.Td label={t('general_projects.job_description')} className="text-gray-600 dark:text-gray-400">
                    {contract.job_description}
                  </Table.Td>
                  <Table.Td label={t('general_projects.contract_amount')} className="font-semibold">
                    {money(contract.contract_amount)}
                  </Table.Td>
                  <Table.Td label={t('common.paid')}>
                    {money(paidFor(contract))}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Body>
          </Table>
        </div>
      ))}
    </div>
  )

  const unphased = contracts.filter(c => !c.phase_id)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.project_phases')}</h3>
        {phases.length > 1 && (
          <button
            type="button"
            onClick={collapse.allExpanded ? collapse.collapseAll : collapse.expandAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline focus:outline-none focus:underline"
          >
            {collapse.allExpanded
              ? t('general_projects.milestone_template.collapse_all')
              : t('general_projects.milestone_template.expand_all')}
          </button>
        )}
      </div>

      {phases.length === 0 ? (
        <EmptyState icon={Briefcase} title={t('general_projects.no_phases')} />
      ) : phases.length === 1 ? (
        // A single-phase project renders no phase level, matching Site Management: a collapsible
        // wrapper around the only phase is indentation, not structure.
        contractsByPhase.get(phases[0].id)?.length
          ? renderContracts(contractsByPhase.get(phases[0].id)!)
          : <p className="text-sm text-gray-500 dark:text-gray-400 italic px-1">
              {t('general_projects.no_contracts_in_phase')}
            </p>
      ) : (
        <div className="space-y-4">
          {phases.map((phase) => {
            const phaseContracts = contractsByPhase.get(phase.id) ?? []
            const expanded = collapse.isExpanded(phase.id)
            const contracted = phaseContracts.reduce((sum, c) => sum + Number(c.contract_amount || 0), 0)
            const paid = phaseContracts.reduce((sum, c) => sum + paidFor(c), 0)
            // Utilisation is paid against the plan, the same ratio the phase card draws. It is
            // only drawn when there is a plan to be a share of.
            const phaseHasPlan = hasPlan && phase.budget_allocated > 0
            const pct = phaseHasPlan
              ? Math.min(100, Math.round((paid / phase.budget_allocated) * 100))
              : 0

            return (
              <div key={phase.id} className="space-y-3">
                <button
                  type="button"
                  onClick={() => collapse.toggle(phase.id)}
                  aria-expanded={expanded}
                  className="w-full text-left px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatPhaseLabel(phase, t('common.phase'))}
                    </h4>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        {phaseContracts.length} {t('general_projects.contract_count').toLowerCase()}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{money(contracted)}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2">
                    {phaseHasPlan ? (
                      <>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {t('common.paid')}: {money(paid)} / {money(phase.budget_allocated)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t('common.paid')}: {money(paid)}
                        </span>
                        <span className="text-xs text-orange-600 dark:text-orange-400 whitespace-nowrap">
                          {t('general_projects.budget_not_set')}
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {expanded && (
                  phaseContracts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic px-4">
                      {t('general_projects.no_contracts_in_phase')}
                    </p>
                  ) : (
                    renderContracts(phaseContracts)
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* A contract whose phase was deleted has its phase_id nulled by the FK. Site Management
          scopes by project_id so those stay visible; without this block they would silently
          vanish from this tab instead. */}
      {unphased.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('general_projects.milestone_template.no_phase_label')}
          </h4>
          {renderContracts(unphased)}
        </div>
      )}
    </div>
  )
}

export default PhasesContractsTab
