import { useMemo, useState } from 'react'
import {
  DollarSign,
  Users,
  Target,
  AlertTriangle,
  ArrowDownRight,
  Banknote
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Modal, Badge, StatGrid, EmptyState } from '../../../ui'
import { differenceInDays } from 'date-fns'
import { daysFromToday } from '../../../../utils/dateOnly'
import { formatDate } from '../../../../utils/formatters'
import { RISK_LEVEL, statusLabelKey } from '../../../../utils/statusDisplay'
import {
  utilisationTone,
  getCreditTypeLabelKey,
  getCreditTypeBadgeVariant
} from '../../Investors/utils/creditCalculations'
import type { ProjectWithFinancials, FundingUtilizationItem } from '../../../General/Projects/types'

interface Props {
  project: ProjectWithFinancials
  onClose: () => void
}

const InvestmentProjectModal: React.FC<Props> = ({ project, onClose }) => {
  const { t, i18n } = useTranslation()
  // The colour bands here are the modal's own; only the word comes from the shared map.
  const riskLabelKey = statusLabelKey(RISK_LEVEL, project.risk_level)
  const [activeTab, setActiveTab] = useState<'overview' | 'funding'>('overview')

  // Derived, not fetched. `fetchFundingUtilization` re-ran the same `credit_allocations`
  // query on *every* click of the Funding tab, with no loading state and a silent catch — so
  // the tab read "Nema izvora financiranja za ovaj projekt" until it resolved, and for ever
  // if it failed. The page already loads these rows with the project
  // (`services/investmentService.ts:65`) and they carry every field this tab shows.
  const fundingUtilization = useMemo<FundingUtilizationItem[]>(() => {
    const items: FundingUtilizationItem[] = []
    for (const allocation of project.debt_allocations) {
      const credit = allocation.credit
      if (!credit?.bank) continue
      items.push({
        id: allocation.id,
        type: credit.credit_type === 'equity' ? 'equity' : 'bank',
        creditType: credit.credit_type ?? null,
        name: `${credit.bank.name} - ${credit.credit_name}`,
        totalAmount: allocation.allocated_amount,
        spentAmount: allocation.used_amount,
        availableAmount: allocation.allocated_amount - allocation.used_amount,
        usageExpirationDate: credit.usage_expiration_date,
        investmentDate: credit.start_date
      })
    }
    return items
  }, [project.debt_allocations])

  const daysToEnd = project.end_date ? daysFromToday(project.end_date) : null
  const isPastEndDate = daysToEnd !== null && daysToEnd < 0

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header
        title={project.name}
        subtitle={`${project.location} | ${t('funding.projects.modal.budget_label')} €${project.budget.toLocaleString('hr-HR')}`}
        onClose={onClose}
      />

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {t('funding.projects.modal.overview_tab')}
          </button>
          <button
            onClick={() => setActiveTab('funding')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              activeTab === 'funding'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {t('funding.projects.modal.funding_tab')}
          </button>
        </div>
      </div>

      <Modal.Body>
        {activeTab === 'overview' && (
          <>
            <StatGrid columns={4} className="mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700 dark:text-blue-300">{t('funding.projects.modal.total_budget_label')}</span>
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100">€{project.budget.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-blue-600">{t('funding.projects.modal.project_value')}</p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-700 dark:text-green-400">{t('funding.projects.modal.active_funders_label')}</span>
                  <Users className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xl font-bold text-green-900 dark:text-green-300">{project.banks.length}</p>
                <p className="text-xs text-green-600">{t('funding.projects.modal.financing_banks')}</p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-700 dark:text-red-400">{t('funding.projects.modal.debt_financing_label')}</span>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-xl font-bold text-red-900 dark:text-red-300">€{project.total_debt.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-red-600">
                  {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}% {t('funding.projects.of_budget')}
                </p>
              </div>

              <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-teal-700 dark:text-teal-400">{t('funding.projects.modal.avg_interest_rate_label')}</span>
                  <Target className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-xl font-bold text-teal-900 dark:text-teal-300">{project.avg_interest_rate.toFixed(1)}%</p>
                <p className="text-xs text-teal-600 dark:text-teal-400">{t('funding.projects.weighted_average')}</p>
              </div>
            </StatGrid>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{t('funding.projects.modal.funding_breakdown_heading')}</h4>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <h5 className="font-medium text-red-900 dark:text-red-300 mb-3 flex items-center">
                  <Banknote className="w-4 h-4 mr-2" />
                  {t('funding.projects.modal.debt_financing_label')}
                </h5>
                {project.debt_allocations.length === 0 ? (
                  <p className="text-sm text-red-700 dark:text-red-400">{t('funding.projects.modal.no_debt_financing')}</p>
                ) : (
                  <div className="space-y-3">
                    {project.debt_allocations.map((allocation) => (
                      <div key={allocation.id} className="bg-white dark:bg-gray-800 p-3 rounded border border-red-200 dark:border-red-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {allocation.credit?.bank?.name || t('funding.investments.unknown_bank')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {allocation.credit?.credit_name} • {allocation.credit?.credit_type.replace(/_/g, ' ')} • {allocation.credit?.interest_rate}% APR
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">€{allocation.allocated_amount.toLocaleString('hr-HR')}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.projects.modal.allocated_to_project')}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('funding.projects.modal.used_amount_label')}</p>
                          <p className="text-xs font-medium text-orange-600">€{allocation.used_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('funding.projects.modal.available_label')}</p>
                          <p className={`text-xs font-medium ${allocation.allocated_amount - allocation.used_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            €{(allocation.allocated_amount - allocation.used_amount).toLocaleString('hr-HR')}
                          </p>
                        </div>
                        {allocation.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">{allocation.description}</p>
                        )}
                        {allocation.credit?.maturity_date && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {t('funding.projects.modal.credit_matures_label')} {formatDate(allocation.credit.maturity_date, i18n.language)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <StatGrid columns={3} className="mb-6">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">{t('funding.projects.modal.leverage_analysis_heading')}</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.debt_to_equity_label')}</span>
                    <span className={`font-medium ${
                      project.debt_to_equity > 2 ? 'text-red-600' :
                      project.debt_to_equity > 1 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {project.debt_to_equity.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.equity_ratio_label')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {project.budget > 0 ? ((project.total_investment / project.budget) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.debt_ratio_label')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">{t('funding.projects.modal.return_analysis_heading')}</h5>
                <div className="space-y-2">
                  {/* The average interest rate lives on the teal tile above — it is a cost of
                      debt, not a return, so it does not belong in this panel a second time. */}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.investment_period_label')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {project.end_date
                        ? `${differenceInDays(new Date(project.end_date), new Date(project.start_date)) / 365 | 0} ${t('funding.projects.modal.years')}`
                        : t('funding.projects.modal.tbd')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.risk_level_label')}</span>
                    <span className={`font-medium ${
                      project.risk_level === 'High' ? 'text-red-600' :
                      project.risk_level === 'Medium' ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {riskLabelKey ? t(riskLabelKey) : project.risk_level}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">{t('funding.projects.modal.timeline_heading')}</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.start_date_label')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDate(project.start_date, i18n.language)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.target_end_label')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {project.end_date ? formatDate(project.end_date, i18n.language) : t('funding.projects.modal.tbd')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.modal.days_remaining_label')}</span>
                    <span className={`font-medium ${
                      isPastEndDate ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {daysToEnd === null
                        ? t('funding.projects.modal.na')
                        : isPastEndDate
                        ? t('funding.projects.modal.days_overdue', { count: -daysToEnd })
                        : t('funding.projects.modal.days_left', { count: daysToEnd })}
                    </span>
                  </div>
                </div>
              </div>
            </StatGrid>

            {project.risk_level !== 'Low' && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                <h5 className="font-medium text-orange-900 dark:text-orange-300 mb-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {t('funding.projects.modal.risk_factors_heading')}
                </h5>
                <div className="space-y-2">
                  {project.debt_to_equity > 2 && (
                    <div className="flex items-center text-orange-800 dark:text-orange-300">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      {t('funding.projects.modal.high_leverage', { ratio: project.debt_to_equity.toFixed(2) })}
                    </div>
                  )}
                  {project.funding_ratio < 90 && (
                    <div className="flex items-center text-orange-800 dark:text-orange-300">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      {t('funding.projects.modal.underfunded', { ratio: project.funding_ratio.toFixed(1) })}
                    </div>
                  )}
                  {isPastEndDate && (
                    <div className="flex items-center text-orange-800 dark:text-orange-300">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      {t('funding.projects.modal.timeline_overrun')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'funding' && (
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{t('funding.projects.modal.funding_sources_heading')}</h4>
            {fundingUtilization.length === 0 ? (
              <EmptyState icon={DollarSign} title={t('funding.projects.modal.no_funding_sources_title')} />
            ) : (
              <div className="space-y-4">
                {fundingUtilization.map((source) => {
                  const utilizationRate = source.totalAmount > 0 ? (source.spentAmount / source.totalAmount) * 100 : 0
                  const tone = utilisationTone(utilizationRate)
                  // `<= 30` alone was also true for periods that had already run out, so an
                  // expired facility was badged "USKORO ISTJEČE" and told the reader it
                  // "istječe za -12 dana".
                  const expiryDays = source.usageExpirationDate ? daysFromToday(source.usageExpirationDate) : null
                  const isExpired = expiryDays !== null && expiryDays < 0
                  const isExpiringSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= 30
                  const typeKey = getCreditTypeLabelKey(source.creditType)

                  return (
                    <div key={`${source.type}-${source.id}`} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <Banknote className="w-5 h-5 text-green-600" />
                            <h5 className="text-lg font-semibold text-gray-900 dark:text-white">{source.name}</h5>
                            <Badge variant={getCreditTypeBadgeVariant(source.creditType ?? '')} size="sm">
                              {typeKey ? t(typeKey) : (source.creditType ?? '').replace(/_/g, ' ')}
                            </Badge>
                            {isExpired && <Badge variant="red" size="sm">{t('funding.projects.modal.expired_badge')}</Badge>}
                            {isExpiringSoon && <Badge variant="orange" size="sm">{t('funding.projects.modal.expiring_soon_badge')}</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('funding.projects.modal.received_label')} {formatDate(source.investmentDate, i18n.language)}
                            {source.usageExpirationDate && (
                              <> • {t('funding.projects.modal.expires_label')} <span className={
                                isExpired ? 'text-red-600 dark:text-red-400 font-medium'
                                  : isExpiringSoon ? 'text-orange-600 dark:text-orange-400 font-medium' : ''
                              }>
                                {formatDate(source.usageExpirationDate, i18n.language)}
                              </span></>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                          <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">{t('funding.projects.modal.total_committed_label')}</p>
                          <p className="text-lg font-bold text-blue-900 dark:text-blue-100">€{source.totalAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                          <p className="text-xs text-red-700 dark:text-red-400 mb-1">{t('funding.projects.modal.spent_label')}</p>
                          <p className="text-lg font-bold text-red-900 dark:text-red-300">€{source.spentAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                          <p className="text-xs text-green-700 dark:text-green-400 mb-1">{t('funding.projects.modal.available_label')}</p>
                          <p className="text-lg font-bold text-green-900 dark:text-green-300">€{source.availableAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-xs text-gray-700 dark:text-gray-200 mb-1">{t('funding.projects.modal.utilization_label')}</p>
                          <p className={`text-lg font-bold ${tone.text}`}>
                            {utilizationRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-600 dark:text-gray-400">{t('funding.projects.modal.funding_utilization_label')}</span>
                          <span className="text-xs font-medium text-gray-900 dark:text-white">
                            €{source.spentAmount.toLocaleString('hr-HR')} / €{source.totalAmount.toLocaleString('hr-HR')}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all duration-300 ${tone.bar}`}
                            style={{ width: `${Math.min(100, utilizationRate)}%` }}
                          ></div>
                        </div>
                      </div>

                      {(utilizationRate >= 80 || isExpiringSoon || isExpired || source.availableAmount <= 0) && (
                        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                          <div className="flex items-center mb-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600 mr-2" />
                            <span className="text-sm font-medium text-orange-900 dark:text-orange-300">{t('funding.projects.modal.warnings_heading')}</span>
                          </div>
                          <div className="space-y-1">
                            {source.availableAmount <= 0 && (
                              <p className="text-sm text-orange-800 dark:text-orange-300">• {t('funding.projects.modal.funds_depleted')}</p>
                            )}
                            {utilizationRate >= 80 && source.availableAmount > 0 && (
                              <p className="text-sm text-orange-800 dark:text-orange-300">• {t('funding.projects.modal.high_utilization', { rate: utilizationRate.toFixed(0) })}</p>
                            )}
                            {isExpired && (
                              <p className="text-sm text-orange-800 dark:text-orange-300">
                                • {t('funding.projects.modal.expired_days_ago', { count: -expiryDays! })}
                              </p>
                            )}
                            {isExpiringSoon && (
                              <p className="text-sm text-orange-800 dark:text-orange-300">
                                • {t('funding.projects.modal.expiring_in_days', { days: expiryDays })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {fundingUtilization.length > 0 && (
              <StatGrid columns={3} className="mt-6">
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">{t('funding.projects.modal.total_committed_footer')}</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    €{fundingUtilization.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString('hr-HR')}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-700 dark:text-red-400 mb-1">{t('funding.projects.modal.total_spent_footer')}</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-300">
                    €{fundingUtilization.reduce((sum, s) => sum + s.spentAmount, 0).toLocaleString('hr-HR')}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <p className="text-sm text-green-700 dark:text-green-400 mb-1">{t('funding.projects.modal.total_available_footer')}</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                    €{fundingUtilization.reduce((sum, s) => sum + s.availableAmount, 0).toLocaleString('hr-HR')}
                  </p>
                </div>
              </StatGrid>
            )}
          </div>
        )}
      </Modal.Body>
    </Modal>
  )
}

export default InvestmentProjectModal
