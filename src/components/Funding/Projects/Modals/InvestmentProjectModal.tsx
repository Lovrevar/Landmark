import { useState } from 'react'
import {
  DollarSign,
  Users,
  Target,
  AlertTriangle,
  ArrowDownRight,
  Banknote
} from 'lucide-react'
import { Modal, Badge, StatGrid, EmptyState } from '../../../ui'
import { format, differenceInDays } from 'date-fns'
import type { ProjectWithFinancials, FundingUtilizationItem } from '../../../General/Projects/types'
import { fetchFundingUtilization } from '../Services/investmentService'

interface Props {
  project: ProjectWithFinancials
  onClose: () => void
}

const InvestmentProjectModal: React.FC<Props> = ({ project, onClose }) => {
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
        subtitle={`${project.location} | Budget: €${project.budget.toLocaleString('hr-HR')}`}
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
            Overview
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
            Funding Utilization
          </button>
        </div>
      </div>

      <Modal.Body>
        {activeTab === 'overview' && (
          <>
            <StatGrid columns={4} className="mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700">Total Budget</span>
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-bold text-blue-900">€{project.budget.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-blue-600">Project value</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-700">Active Funders</span>
                  <Users className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xl font-bold text-green-900">{project.banks.length}</p>
                <p className="text-xs text-green-600">Financing banks</p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-700">Debt Financing</span>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-xl font-bold text-red-900">€{project.total_debt.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-red-600">
                  {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}% of budget
                </p>
              </div>

              <div className="bg-teal-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-teal-700">Avg Interest Rate</span>
                  <Target className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-xl font-bold text-teal-900">{project.expected_roi.toFixed(1)}%</p>
                <p className="text-xs text-teal-600">Weighted average</p>
              </div>
            </StatGrid>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4">Funding Breakdown</h4>
              <div className="bg-red-50 p-4 rounded-lg">
                <h5 className="font-medium text-red-900 mb-3 flex items-center">
                  <Banknote className="w-4 h-4 mr-2" />
                  Debt Financing
                </h5>
                {project.debt_allocations.length === 0 ? (
                  <p className="text-sm text-red-700">No debt financing</p>
                ) : (
                  <div className="space-y-3">
                    {project.debt_allocations.map((allocation) => (
                      <div key={allocation.id} className="bg-white p-3 rounded border border-red-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {allocation.credit?.bank?.name || 'Unknown Bank'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {allocation.credit?.credit_name} • {allocation.credit?.credit_type.replace(/_/g, ' ')} • {allocation.credit?.interest_rate}% APR
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">€{allocation.allocated_amount.toLocaleString('hr-HR')}</p>
                            <p className="text-xs text-gray-500">Allocated to Project</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs text-gray-600">Used Amount:</p>
                          <p className="text-xs font-medium text-orange-600">€{allocation.used_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-gray-600">Available:</p>
                          <p className={`text-xs font-medium ${allocation.allocated_amount - allocation.used_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            €{(allocation.allocated_amount - allocation.used_amount).toLocaleString('hr-HR')}
                          </p>
                        </div>
                        {allocation.description && (
                          <p className="text-xs text-gray-600 mt-2 italic">{allocation.description}</p>
                        )}
                        {allocation.credit?.maturity_date && (
                          <p className="text-xs text-gray-600 mt-1">
                            Credit Matures: {format(new Date(allocation.credit.maturity_date), 'MMM dd, yyyy')}
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
                <h5 className="font-medium text-gray-900 mb-3">Leverage Analysis</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Debt-to-Equity:</span>
                    <span className={`font-medium ${
                      project.debt_to_equity > 2 ? 'text-red-600' :
                      project.debt_to_equity > 1 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {project.debt_to_equity.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Equity Ratio:</span>
                    <span className="font-medium text-gray-900">
                      {project.budget > 0 ? ((project.total_investment / project.budget) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Debt Ratio:</span>
                    <span className="font-medium text-gray-900">
                      {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-3">Return Analysis</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Expected ROI:</span>
                    <span className="font-medium text-green-600">{project.expected_roi.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Investment Period:</span>
                    <span className="font-medium text-gray-900">
                      {project.end_date
                        ? `${differenceInDays(new Date(project.end_date), new Date(project.start_date)) / 365 | 0} years`
                        : 'TBD'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Risk Level:</span>
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
                <h5 className="font-medium text-gray-900 mb-3">Timeline</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Start Date:</span>
                    <span className="font-medium text-gray-900">
                      {format(new Date(project.start_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Target End:</span>
                    <span className="font-medium text-gray-900">
                      {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : 'TBD'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Days Remaining:</span>
                    <span className={`font-medium ${
                      project.end_date && differenceInDays(new Date(project.end_date), new Date()) < 0
                        ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {project.end_date
                        ? differenceInDays(new Date(project.end_date), new Date())
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </StatGrid>

            {project.risk_level !== 'Low' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h5 className="font-medium text-orange-900 mb-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Risk Factors
                </h5>
                <div className="space-y-2">
                  {project.debt_to_equity > 2 && (
                    <div className="flex items-center text-orange-800">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      High leverage ratio ({project.debt_to_equity.toFixed(2)}x)
                    </div>
                  )}
                  {project.funding_ratio < 90 && (
                    <div className="flex items-center text-orange-800">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      Underfunded project ({project.funding_ratio.toFixed(1)}%)
                    </div>
                  )}
                  {project.end_date && differenceInDays(new Date(project.end_date), new Date()) < 0 && (
                    <div className="flex items-center text-orange-800">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                      Project timeline overrun
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'funding' && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Funding Sources Utilization</h4>
            {fundingUtilization.length === 0 ? (
              <EmptyState icon={DollarSign} title="No funding sources for this project" />
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
                            <Badge variant="green" size="sm">BANK</Badge>
                            {isExpiringSoon && <Badge variant="orange" size="sm">EXPIRING SOON</Badge>}
                          </div>
                          <p className="text-sm text-gray-600">
                            Received: {format(new Date(source.investmentDate), 'MMM dd, yyyy')}
                            {source.usageExpirationDate && (
                              <> • Expires: <span className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                                {format(new Date(source.usageExpirationDate), 'MMM dd, yyyy')}
                              </span></>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-xs text-blue-700 mb-1">Total Committed</p>
                          <p className="text-lg font-bold text-blue-900">€{source.totalAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                          <p className="text-xs text-red-700 mb-1">Spent</p>
                          <p className="text-lg font-bold text-red-900">€{source.spentAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="text-xs text-green-700 mb-1">Available</p>
                          <p className="text-lg font-bold text-green-900">€{source.availableAmount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-700 mb-1">Utilization</p>
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
                          <span className="text-xs text-gray-600">Funding Utilization</span>
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
                            <span className="text-sm font-medium text-orange-900">Warnings</span>
                          </div>
                          <div className="space-y-1">
                            {source.availableAmount <= 0 && (
                              <p className="text-sm text-orange-800">• Funds fully depleted</p>
                            )}
                            {utilizationRate >= 80 && source.availableAmount > 0 && (
                              <p className="text-sm text-orange-800">• High utilization rate ({utilizationRate.toFixed(0)}%)</p>
                            )}
                            {isExpiringSoon && (
                              <p className="text-sm text-orange-800">
                                • Usage period expires in {differenceInDays(new Date(source.usageExpirationDate!), new Date())} days
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
                  <p className="text-sm text-blue-700 mb-1">Total Committed</p>
                  <p className="text-2xl font-bold text-blue-900">
                    €{fundingUtilization.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString('hr-HR')}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 mb-1">Total Spent</p>
                  <p className="text-2xl font-bold text-red-900">
                    €{fundingUtilization.reduce((sum, s) => sum + s.spentAmount, 0).toLocaleString('hr-HR')}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 mb-1">Total Available</p>
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
