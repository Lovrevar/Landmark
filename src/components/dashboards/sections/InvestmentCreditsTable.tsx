import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Calendar, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { Button, Badge } from '../../ui'
import { formatEuro } from '../../../utils/formatters'
import type { BankCredit } from '../../../types/investment'

interface Props {
  bankCredits: BankCredit[]
}

const InvestmentCreditsTable: React.FC<Props> = ({ bankCredits }) => {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Active Investments & Expiration Dates</h2>
          <Button variant="primary" onClick={() => navigate('/accounting-credits')}>
            View All Credits
          </Button>
        </div>
      </div>
      <div className="p-6">
        {bankCredits.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Investments Found</h3>
            <p className="text-gray-600">No investments available.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bankCredits.map((credit) => {
              const utilizationPercent = credit.amount > 0
                ? (Number(credit.used_amount || 0) / Number(credit.amount)) * 100
                : 0
              const maturityDays = credit.maturity_date
                ? differenceInDays(new Date(credit.maturity_date), new Date())
                : null
              const usageDays = credit.usage_expiration_date
                ? differenceInDays(new Date(credit.usage_expiration_date), new Date())
                : null
              const maturityWarning = maturityDays !== null && maturityDays <= 90 && maturityDays > 0
              const usageWarning = usageDays !== null && usageDays <= 90 && usageDays > 0

              return (
                <div key={credit.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {credit.credit_name || `${credit.company?.name || 'Credit'} - ${credit.credit_type.replace('_', ' ')}`}
                        </h3>
                        {credit.project && <Badge variant="blue" size="sm">{credit.project.name}</Badge>}
                        {maturityWarning && <Badge variant="orange" size="sm">Maturing Soon</Badge>}
                        {usageWarning && <Badge variant="yellow" size="sm">Usage Expiring</Badge>}
                      </div>
                      <p className="text-gray-600">{credit.company?.name || 'Unknown Company'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatEuro(Number(credit.amount))}</p>
                      <p className="text-sm text-gray-600">Investment Amount</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-700">Used</p>
                      <p className="text-lg font-bold text-blue-900">{formatEuro(Number(credit.used_amount || 0))}</p>
                    </div>
                    <div className="bg-teal-50 p-3 rounded-lg">
                      <p className="text-xs text-teal-700">Repaid</p>
                      <p className="text-lg font-bold text-teal-900">{formatEuro(Number(credit.repaid_amount || 0))}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-green-700">Available</p>
                      <p className="text-lg font-bold text-green-900">
                        {formatEuro(Number(credit.amount) - Number(credit.used_amount || 0))}
                      </p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-xs text-red-700">Outstanding</p>
                      <p className="text-lg font-bold text-red-900">{formatEuro(Number(credit.outstanding_balance || 0))}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-xs text-orange-700">Interest Rate</p>
                      <p className="text-lg font-bold text-orange-900">{Number(credit.interest_rate || 0).toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600 flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Start Date:</span>
                      </span>
                      <p className="font-medium text-gray-900">{format(new Date(credit.start_date), 'MMM dd, yyyy')}</p>
                    </div>
                    {credit.maturity_date && (
                      <div>
                        <span className="text-gray-600 flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Maturity Date:</span>
                        </span>
                        <p className={`font-medium ${maturityWarning ? 'text-orange-600' : 'text-gray-900'}`}>
                          {format(new Date(credit.maturity_date), 'MMM dd, yyyy')}
                          {maturityDays !== null && maturityDays > 0 && (
                            <span className="text-xs ml-1">({maturityDays}d)</span>
                          )}
                        </p>
                      </div>
                    )}
                    {credit.usage_expiration_date && (
                      <div>
                        <span className="text-gray-600 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Usage Expires:</span>
                        </span>
                        <p className={`font-medium ${usageWarning ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {format(new Date(credit.usage_expiration_date), 'MMM dd, yyyy')}
                          {usageDays !== null && usageDays > 0 && (
                            <span className="text-xs ml-1">({usageDays}d)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Utilization</span>
                      <span className="font-semibold text-gray-900">{utilizationPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          utilizationPercent >= 90 ? 'bg-red-500' :
                          utilizationPercent >= 70 ? 'bg-orange-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default InvestmentCreditsTable
