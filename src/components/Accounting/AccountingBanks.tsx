import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, CreditCard, DollarSign, TrendingUp, TrendingDown, Percent } from 'lucide-react'

interface BankCredit {
  id: string
  credit_name: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string
  project?: {
    id: string
    name: string
  }
}

interface BankWithCredits {
  id: string
  name: string
  oib: string
  is_bank: boolean
  bank_id: string
  total_credit_limit: number
  total_used: number
  total_repaid: number
  total_outstanding: number
  credits: BankCredit[]
}

const AccountingBanks: React.FC = () => {
  const [banks, setBanks] = useState<BankWithCredits[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBanks()
  }, [])

  const fetchBanks = async () => {
    try {
      setLoading(true)

      // Fetch all banks (companies marked as banks)
      const { data: banksData, error: banksError } = await supabase
        .from('accounting_companies')
        .select('id, name, oib, is_bank, bank_id')
        .eq('is_bank', true)
        .order('name')

      if (banksError) throw banksError

      // For each bank, fetch all credits
      const banksWithCredits: BankWithCredits[] = []

      for (const bank of banksData || []) {
        if (!bank.bank_id) continue

        const { data: creditsData, error: creditsError } = await supabase
          .from('bank_credits')
          .select(`
            id,
            credit_name,
            amount,
            used_amount,
            repaid_amount,
            outstanding_balance,
            interest_rate,
            start_date,
            maturity_date,
            project:projects(id, name)
          `)
          .eq('bank_id', bank.bank_id)
          .order('credit_name')

        if (creditsError) throw creditsError

        const credits = creditsData || []
        const totalCreditLimit = credits.reduce((sum, c) => sum + c.amount, 0)
        const totalUsed = credits.reduce((sum, c) => sum + (c.used_amount || 0), 0)
        const totalRepaid = credits.reduce((sum, c) => sum + (c.repaid_amount || 0), 0)
        const totalOutstanding = credits.reduce((sum, c) => sum + c.outstanding_balance, 0)

        banksWithCredits.push({
          ...bank,
          total_credit_limit: totalCreditLimit,
          total_used: totalUsed,
          total_repaid: totalRepaid,
          total_outstanding: totalOutstanding,
          credits
        })
      }

      setBanks(banksWithCredits)
    } catch (error) {
      console.error('Error fetching banks:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje...</p>
        </div>
      </div>
    )
  }

  const totalCreditAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_credit_limit, 0)
  const totalUsedAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_used, 0)
  const totalRepaidAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_repaid, 0)
  const totalOutstandingAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_outstanding, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banke</h1>
          <p className="text-sm text-gray-600 mt-1">Pregled svih bankovnih kredita</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupan kredit limit</p>
              <p className="text-2xl font-bold text-gray-900">€{totalCreditAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno iskorišteno</p>
              <p className="text-2xl font-bold text-blue-600">€{totalUsedAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno vraćeno</p>
              <p className="text-2xl font-bold text-green-600">€{totalRepaidAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupan dug</p>
              <p className="text-2xl font-bold text-red-600">€{totalOutstandingAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Banks List */}
      {banks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nema banaka</h3>
          <p className="text-gray-600">Nema dodanih banaka u sustavu</p>
        </div>
      ) : (
        <div className="space-y-6">
          {banks.map((bank) => {
            const utilizationPercent = bank.total_credit_limit > 0
              ? (bank.total_used / bank.total_credit_limit) * 100
              : 0
            const availableCredit = bank.total_credit_limit - bank.total_used

            return (
              <div key={bank.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building2 className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{bank.name}</h2>
                      <p className="text-sm text-gray-600">OIB: {bank.oib}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Broj kredita</p>
                    <p className="text-3xl font-bold text-blue-600">{bank.credits.length}</p>
                  </div>
                </div>

                {/* Bank Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Kredit limit</p>
                    <p className="text-lg font-bold text-gray-900">€{bank.total_credit_limit.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-blue-700 mb-1">Iskorišteno</p>
                    <p className="text-lg font-bold text-blue-900">€{bank.total_used.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-700 mb-1">Dostupno</p>
                    <p className="text-lg font-bold text-green-900">€{availableCredit.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-700 mb-1">Vraćeno</p>
                    <p className="text-lg font-bold text-green-900">€{bank.total_repaid.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-xs text-red-700 mb-1">Dug banci</p>
                    <p className="text-lg font-bold text-red-900">€{bank.total_outstanding.toLocaleString()}</p>
                  </div>
                </div>

                {/* Utilization Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Ukupna iskorištenost kredita</span>
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

                {/* Credits List */}
                {bank.credits.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Krediti</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bank.credits.map((credit) => {
                        const usedAmount = credit.used_amount || 0
                        const available = credit.amount - usedAmount
                        const creditUtilization = credit.amount > 0 ? (usedAmount / credit.amount) * 100 : 0
                        const isExpired = new Date(credit.maturity_date) < new Date()

                        return (
                          <div key={credit.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{credit.credit_name || 'Kredit'}</h4>
                                {credit.project && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    Projekat: {credit.project.name}
                                  </p>
                                )}
                              </div>
                              {isExpired && (
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                                  ISTEKAO
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 mb-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Limit:</span>
                                <span className="font-medium text-gray-900">€{credit.amount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Iskorišteno:</span>
                                <span className="font-medium text-blue-600">€{usedAmount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Dostupno:</span>
                                <span className="font-medium text-green-600">€{available.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Vraćeno:</span>
                                <span className="font-medium text-green-600">€{(credit.repaid_amount || 0).toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Dug:</span>
                                <span className="font-medium text-red-600">€{credit.outstanding_balance.toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Kamata:</span>
                                <span className="font-medium text-gray-900">{credit.interest_rate}%</span>
                              </div>
                            </div>

                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  creditUtilization >= 90 ? 'bg-red-500' :
                                  creditUtilization >= 70 ? 'bg-orange-500' :
                                  'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1 text-right">{creditUtilization.toFixed(1)}%</p>
                          </div>
                        )
                      })}
                    </div>
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

export default AccountingBanks
