import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { CreditCard, Building2, ChevronDown, ChevronUp, TrendingUp, DollarSign, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface BankCredit {
  id: string
  bank_id: string
  project_id: string | null
  company_id: string | null
  credit_name: string
  credit_type: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string
  usage_expiration_date: string | null
  status: string
  purpose: string
  bank?: {
    id: string
    name: string
  }
  project?: {
    id: string
    name: string
  }
  company?: {
    id: string
    name: string
  }
}

const CreditsManagement: React.FC = () => {
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCredits()
  }, [])

  const fetchCredits = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bank_credits')
        .select(`
          *,
          bank:banks(id, name),
          project:projects(id, name),
          company:accounting_companies(id, name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setCredits(data || [])
    } catch (error) {
      console.error('Error fetching credits:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCredit = (creditId: string) => {
    setExpandedCredits(prev => {
      const next = new Set(prev)
      if (next.has(creditId)) {
        next.delete(creditId)
      } else {
        next.add(creditId)
      }
      return next
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading credits...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <CreditCard className="w-8 h-8 mr-3 text-blue-600" />
          Krediti
        </h1>
        <p className="text-gray-600 mt-2">Pregled svih bankovnih kredita</p>
      </div>

      {credits.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nema evidentiranih kredita</p>
        </div>
      ) : (
        <div className="space-y-4">
          {credits.map((credit) => {
            const isExpanded = expandedCredits.has(credit.id)
            const availableAmount = credit.amount - credit.used_amount
            const utilizationPercentage = credit.amount > 0 ? (credit.used_amount / credit.amount) * 100 : 0
            const netUsed = credit.used_amount - credit.repaid_amount

            return (
              <div key={credit.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => toggleCredit(credit.id)}
                        className="p-3 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                        title={isExpanded ? "Collapse credit" : "Expand credit"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-6 h-6 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-6 h-6 text-blue-600" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {credit.credit_name || 'Unnamed Credit'}
                          </h3>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(credit.status)}`}>
                            {credit.status}
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">
                          {credit.bank?.name || 'Unknown Bank'}
                          {credit.company && ` • ${credit.company.name}`}
                          {credit.project && ` • ${credit.project.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                      <p className="text-sm text-gray-600">Credit Amount</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-700">Credit Amount</p>
                      <p className="text-lg font-bold text-blue-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-sm text-orange-700">Paid Out</p>
                      <p className="text-lg font-bold text-orange-900">€{credit.used_amount.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${netUsed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${netUsed > 0 ? 'text-red-700' : 'text-gray-700'}`}>Used (Net)</p>
                      <p className={`text-lg font-bold ${netUsed > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                        €{netUsed.toLocaleString('hr-HR')}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${availableAmount <= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className={`text-sm ${availableAmount <= 0 ? 'text-red-700' : 'text-green-700'}`}>Available</p>
                      <p className={`text-lg font-bold ${availableAmount <= 0 ? 'text-red-900' : 'text-green-900'}`}>
                        €{availableAmount.toLocaleString('hr-HR')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Utilization</span>
                      <span className="text-sm font-medium">{utilizationPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          utilizationPercentage > 100 ? 'bg-red-600' :
                          utilizationPercentage > 80 ? 'bg-orange-600' :
                          'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
                      ></div>
                    </div>
                    {utilizationPercentage > 100 && (
                      <p className="text-xs text-red-600 mt-1">
                        Over limit by €{(credit.used_amount - credit.amount).toLocaleString('hr-HR')}
                      </p>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <Building2 className="w-5 h-5 mr-2" />
                          Credit Details
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Credit Type:</span>
                            <span className="font-medium text-gray-900">{credit.credit_type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Interest Rate:</span>
                            <span className="font-medium text-gray-900">{credit.interest_rate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Outstanding Balance:</span>
                            <span className="font-medium text-gray-900">€{credit.outstanding_balance.toLocaleString('hr-HR')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Repaid Amount:</span>
                            <span className="font-medium text-green-600">€{credit.repaid_amount.toLocaleString('hr-HR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2" />
                          Dates & Timeline
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Start Date:</span>
                            <span className="font-medium text-gray-900">
                              {format(new Date(credit.start_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Maturity Date:</span>
                            <span className="font-medium text-gray-900">
                              {format(new Date(credit.maturity_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          {credit.usage_expiration_date && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Usage Expiration:</span>
                              <span className="font-medium text-gray-900">
                                {format(new Date(credit.usage_expiration_date), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {credit.purpose && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-2">Purpose</h4>
                        <p className="text-sm text-gray-600">{credit.purpose}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CreditsManagement
