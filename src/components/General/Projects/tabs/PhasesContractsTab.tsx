import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Briefcase, ChevronDown } from 'lucide-react'
import { EmptyState, Table } from '../../../ui'
import { usePhaseCollapseState } from '../hooks/usePhaseCollapseState'
import type { PhaseStatus } from '../utils'
import type { Phase, ContractWithDetails } from '../types'

interface PhasesContractsTabProps {
  phases: Phase[]
  contracts: ContractWithDetails[]
  projectId?: string
}

const formatEur = (n: number) => `€${n.toLocaleString('hr-HR')}`

const PhasesContractsTab: React.FC<PhasesContractsTabProps> = ({ phases, contracts, projectId }) => {
  const { t } = useTranslation()

  const contractsByPhase = useMemo(() => {
    const map = new Map<string, ContractWithDetails[]>()
    for (const c of contracts) {
      const key = c.phase?.phase_name
      if (!key) continue
      const bucket = map.get(key)
      if (bucket) bucket.push(c)
      else map.set(key, [c])
    }
    return map
  }, [contracts])

  const phaseStatuses = useMemo<PhaseStatus[]>(
    () => phases.map(p => ({
      key: p.phase_name,
      total: contractsByPhase.get(p.phase_name)?.length ?? 0,
      completed: 0,
      overdue: 0,
    })),
    [phases, contractsByPhase]
  )

  const collapse = usePhaseCollapseState(projectId, phaseStatuses, 'phase_contracts_collapse')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.project_phases')}</h3>
        {phases.length > 0 && (
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
      ) : (
        <div className="space-y-4">
          {phases.map((phase) => {
            const phaseContracts = contractsByPhase.get(phase.phase_name) ?? []
            const expanded = collapse.isExpanded(phase.phase_name)
            const phaseTotal = phaseContracts.reduce((sum, c) => sum + Number(c.contract_amount || 0), 0)
            const pct = phase.budget_allocated > 0
              ? Math.min(100, Math.round((phase.budget_used / phase.budget_allocated) * 100))
              : 0

            return (
              <div key={phase.id} className="space-y-3">
                <button
                  type="button"
                  onClick={() => collapse.toggle(phase.phase_name)}
                  aria-expanded={expanded}
                  className="w-full text-left px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t('common.phase')} {phase.phase_number}: {phase.phase_name}
                    </h4>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        {phaseContracts.length} {t('general_projects.contract_count').toLowerCase()}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatEur(phaseTotal)}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {t('general_projects.used')}: {formatEur(phase.budget_used)} / {formatEur(phase.budget_allocated)}
                    </span>
                  </div>
                </button>

                {expanded && (
                  phaseContracts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic px-4">
                      {t('general_projects.no_contracts_in_phase')}
                    </p>
                  ) : (
                    <Table dense>
                      <Table.Head>
                        <Table.Tr>
                          <Table.Th>{t('common.subcontractor')}</Table.Th>
                          <Table.Th>{t('general_projects.job_description')}</Table.Th>
                          <Table.Th>{t('general_projects.contract_amount')}</Table.Th>
                          <Table.Th>{t('general_projects.realized')}</Table.Th>
                        </Table.Tr>
                      </Table.Head>
                      <Table.Body>
                        {phaseContracts.map((contract) => (
                          <Table.Tr key={contract.id}>
                            <Table.Td label={t('common.subcontractor')} className="font-medium text-gray-900 dark:text-white">
                              {contract.subcontractor.name}
                            </Table.Td>
                            <Table.Td label={t('general_projects.job_description')} className="text-gray-600 dark:text-gray-400">
                              {contract.job_description}
                            </Table.Td>
                            <Table.Td label={t('general_projects.contract_amount')} className="font-semibold">
                              {formatEur(contract.contract_amount)}
                            </Table.Td>
                            <Table.Td label={t('general_projects.realized')}>
                              {formatEur(contract.budget_realized)}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Body>
                    </Table>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PhasesContractsTab
