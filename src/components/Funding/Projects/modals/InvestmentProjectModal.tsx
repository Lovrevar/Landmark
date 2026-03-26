import { useState } from 'react'
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
import { format, differenceInDays } from 'date-fns'
import type { ProjectWithFinancials, FundingUtilizationItem } from '../../../General/Projects/types'
import { fetchFundingUtilization } from '../services/investmentService'

interface Props {
  project: ProjectWithFinancials
  onClose: () => void
}

const InvestmentProjectModal: React.FC<Props> = ({ project, onClose }) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'overview' | 'funding'>('overview')
  const [fundingUtilization, setFundingUtilization] = useState<FundingUtilizationItem[]>([])

  const loadFundingUtilization = async () => {
    try {
      const data = await fetchFundingUtilization(project.id)
      setFundingUtilization(data)
    } catch (error) {
      console.error('Error fetching funding utilization:', error)
    }
  }

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header
        title={project.name}
        subtitle={`${project.location} | ${t('funding.projects.modal.budget_label')} €${project.budget.toLocaleString('hr-HR')}`}
        onClose={onClose}
      />

      <div className="border-b border-gray-200">
        <div className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('funding.projects.modal.overview_tab')}
          </button>
          <button
            onClick={async () => {
              setActiveTab('funding')
              await loadFundingUtilization()
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              activeTab === 'funding'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700">{t('funding.projects.modal.total_budget_label')}</span>
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-bold text-blue-900">€{project.budget.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-blue-600">{t('funding.projects.modal.project_value')}</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-700">{t('funding.projects.modal.active_funders_label')}</span>
                  <Users className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xl font-bold text-green-900">{project.banks.length}</p>
                <p className="text-xs text-green-600">{t('funding.projects.modal.financing_banks')}</p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-700">{t('funding.projects.modal.debt_financing_label')}</span>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-xl font-bold text-red-900">€{project.total_debt.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-red-600">
                  {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}% {t('funding.projects.of_budget')}
                </p>
              </div>

              <div className="bg-teal-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-teal-700">{t('funding.projects.modal.avg_interest_rate_label')}</span>
                  <Target className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-xl font-bold text-teal-900">{project.expected_roi.toFixed(1)}%</p>
                <p className="text-xs text-teal-600">{t('funding.projects.weighted_average')}</p>
              </div>
            </StatGrid>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4">{t('funding.projects.modal.funding_breakdown_heading')}</h4>
              <div className="bg-red-50 p-4 rounded-lg">
                <h5 className="font-medium text-red-900 mb-3 flex items-center">
                  <Banknote className="w-4 h-4 mr-2" />
                  {t('funding.projects.modal.debt_financing_label')}
                </h5>
                {project.debt_allocations.length === 0 ? (
                  <p className="text-sm text-red-700">{t('funding.projects.modal.no_debt_financing')}</p>
                ) : (
                  <div className="space-y-3">
                    {project.debt_allocations.map((allocation) => (
                      <div key={allocation.id} className="bg-white p-3 rounded border border-red-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {allocation.credit?.bank?.name || t('funding.investments.unknown_bank')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {allocation.credit?.credit_name} • {allocation.credit?.credit_type.replace(/_/g, ' ')} • {allocation.credit?.interest_rate}% APR
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">€{allocation.allocated_amount.toLocaleString('hr-HR')}</p>
                            <p className="text-xs text-gray-500">{t('funding.projects.modal.allocated_to_project')}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs text-gray-600">{t('funding.projects.modal.used_amount_label')}</p>
                          <p className="text-xs font-medium text-orange-600">€{allocation.used_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-gray-600">{t('funding.projects.modal.available_label')}</p>
                          <p className={`text-xs font-medium ${allocation.allocated_amount - allocation.used_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            €{(allocation.allocated_amount - allocation.used_amount).toLocaleString('hr-HR')}
                          </p>
                        </div>
                        {allocation.description && (
                          <p className="text-xs text-gray-600 mt-2 italic">{allocation.description}</p>
                        )}
                        {allocation.credit?.maturity_date && (
                          <p className="text-xs text-gray-600 mt-1">
                            {t('funding.projects.modal.credit_matures_label')} {format(new Date(allocation.credit.maturity_date), 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <StatGrid columns={3} className="mb-6">
              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-3">{t('funding.projects.modal.leverage_analysis_heading')}</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.debt_to_equity_label')}</span>
                    <span className={`font-medium ${
                      project.debt_to_equity > 2 ? 'text-red-600' :
                      project.debt_to_equity > 1 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {project.debt_to_equity.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.equity_ratio_label')}</span>
                    <span className="font-medium text-gray-900">
                      {project.budget > 0 ? ((project.total_investment / project.budget) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.debt_ratio_label')}</span>
                    <span className="font-medium text-gray-900">
                      {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-3">{t('funding.projects.modal.return_analysis_heading')}</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.expected_roi_label')}</span>
                    <span className="font-medium text-green-600">{project.expected_roi.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.investment_period_label')}</span>
                    <span className="font-medium text-gray-900">
                      {project.end_date
                        ? `${differenceInDays(new Date(project.end_date), new Date(project.start_date)) / 365 | 0} ${t('funding.projects.modal.years')}`
                        : t('funding.projects.modal.tbd')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.risk_level_label')}</span>
                    <span className={`font-medium ${
                      project.risk_level === 'High' ? 'text-red-600' :
                      project.risk_level === 'Medium' ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {project.risk_level}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-3">{t('funding.projects.modal.timeline_heading')}</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.start_date_label')}</span>
                    <span className="font-medium text-gray-900">
                      {format(new Date(project.start_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.target_end_label')}</span>
                    <span className="font-medium text-gray-900">
                      {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : t('funding.projects.modal.tbd')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">{t('funding.projects.modal.days_remaining_label')}</span>
                    <span className={`font-medium ${
                      project.end_date && differenceInDays(new Date(project.end_date), new Date()) < 0
                        ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {project.end_date
                        ? differenceInDays(new Date(project.end_date), new Date())
                        : t('funding.projects.modal.na')}
                    </span>
                  </div>
                </div>
              </div>
            </StatGrid>

            {project.risk_level !== 'Low' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h5 className="font-medium text-orange-900 mb-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {t('funding.projects.modal.risk_factors_heading')}
                </h5>
                <div className="space-y-2">
                  {project.debt_to_equity > 2 && (
                    <div className="flex items-center text-orange-800">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      {t('funding.projects.modal.high_leverage', { ratio: project.debt_to_equity.toFixed(2) })}
                    </div>
                  )}
                  {project.funding_ratio < 90 && (
                    <div className="flex items-center text-orange-800">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      {t('funding.projects.modal.underfunded', { ratio: project.funding_ratio.toFixed(1) })}
                    </div>
                  )}
                  {project.end_date && differenceInDays(new Date(project.end_date), new Date()) < 0 && (
                    <div className="flex items-center text-orange-800">
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
            <h4 className="font-semibold text-gray-900 mb-4">{t('funding.projects.modal.funding_sources_heading')}</h4>
            {fundingUtilization.length === 0 ? (
              <EmptyState icon={DollarSign} title={t('funding.projects.modal.no_funding_sources_title')} />
            ) : (
              <div className="space-y-4">
                {fundingUtilization.map((source) => {
                  const utilizationRate = source.totalAmount > 0 ? (source.spentAmount / source.totalAmount) * 100 : 0
                  const isExpiringSoon = source.usageExpirationDate && differenceInDays(new Date(source.usageExpirationDate), new Date()) <= 30

                  return (
                    <div key={`${source.type}-${source.id}`} className="bg-white border border-gray-200 rounded-lg p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <Banknote className="w-5 h-5 text-green-600" />
                            <h5 className="text-lg font-semibold text-gray-900">{source.name}</h5>
                            <Badge variant="green" size="sm">{t('funding.projects.modal.bank_badge')}</Badge>
                            {isExpiringSoon && <Badge variant="orange" size="sm">{t('funding.projects.modal.expiring_soon_badge')}</Badge>}
                          </div>
                          <p className="text-sm text-gray-600">
                            {t('funding.projects.modal.received_label')} {format(new Date(source.investmentDate), 'MMM dd, yyyy')}
                            {source.usageExpirationDate && (
                              <> • {t('funding.projects.modal.expires_label')} <span className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                                {format(new Date(source.usageExpirationDate), 'MMM dd, yyyy')}
                              </span></>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-xs text-blue-700 mb-1">{t('funding.projects.modal.total_committed_label')}</p>
                          <p className="text-lg font-bold text-blue-900">€{source.totalAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                          <p className="text-xs text-red-700 mb-1">{t('funding.projects.modal.spent_label')}</p>
                          <p className="text-lg font-bold text-red-900">€{source.spentAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="text-xs text-green-700 mb-1">{t('funding.projects.modal.available_label')}</p>
                          <p className="text-lg font-bold text-green-900">€{source.availableAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-700 mb-1">{t('funding.projects.modal.utilization_label')}</p>
                          <p className={`text-lg font-bold ${
                            utilizationRate >= 80 ? 'text-orange-600' :
                            utilizationRate >= 50 ? 'text-blue-600' : 'text-green-600'
                          }`}>
                            {utilizationRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-600">{t('funding.projects.modal.funding_utilization_label')}</span>
                          <span className="text-xs font-medium text-gray-900">
                            €{source.spentAmount.toLocaleString('hr-HR')} / €{source.totalAmount.toLocaleString('hr-HR')}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all duration-300 ${
                              utilizationRate >= 90 ? 'bg-red-600' :
                              utilizationRate >= 80 ? 'bg-orange-600' :
                              utilizationRate >= 50 ? 'bg-blue-600' : 'bg-green-600'
                            }`}
                            style={{ width: `${Math.min(100, utilizationRate)}%` }}
                          ></div>
                        </div>
                      </div>

                      {(utilizationRate >= 80 || isExpiringSoon || source.availableAmount <= 0) && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center mb-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600 mr-2" />
                            <span className="text-sm font-medium text-orange-900">{t('funding.projects.modal.warnings_heading')}</span>
                          </div>
                          <div className="space-y-1">
                            {source.availableAmount <= 0 && (
                              <p className="text-sm text-orange-800">• {t('funding.projects.modal.funds_depleted')}</p>
                            )}
                            {utilizationRate >= 80 && source.availableAmount > 0 && (
                              <p className="text-sm text-orange-800">• {t('funding.projects.modal.high_utilization', { rate: utilizationRate.toFixed(0) })}</p>
                            )}
                            {isExpiringSoon && (
                              <p className="text-sm text-orange-800">
                                • {t('funding.projects.modal.expiring_in_days', { days: differenceInDays(new Date(source.usageExpirationDate!), new Date()) })}
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700 mb-1">{t('funding.projects.modal.total_committed_footer')}</p>
                  <p className="text-2xl font-bold text-blue-900">
                    €{fundingUtilization.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString('hr-HR')}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 mb-1">{t('funding.projects.modal.total_spent_footer')}</p>
                  <p className="text-2xl font-bold text-red-900">
                    €{fundingUtilization.reduce((sum, s) => sum + s.spentAmount, 0).toLocaleString('hr-HR')}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 mb-1">{t('funding.projects.modal.total_available_footer')}</p>
                  <p className="text-2xl font-bold text-green-900">
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
