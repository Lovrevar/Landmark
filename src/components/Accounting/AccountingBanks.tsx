import React from 'react'
import { Building2, CreditCard, DollarSign, TrendingUp, TrendingDown, Plus, Edit2, Trash2 } from 'lucide-react'
import { useBanks } from './hooks/useBanks'
import BankCreditFormModal from './forms/BankCreditFormModal'

const AccountingBanks: React.FC = () => {
  const {
    banks,
    projects,
    companies,
    loading,
    showCreditForm,
    setShowCreditForm,
    editingCredit,
    newCredit,
    setNewCredit,
    addCredit,
    handleEditCredit,
    handleDeleteCredit,
    resetCreditForm
  } = useBanks()

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
        <button
          onClick={() => setShowCreditForm(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Credit
        </button>
      </div>

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
                      {bank.contact_person && (
                        <p className="text-sm text-gray-600">{bank.contact_person}</p>
                      )}
                      {bank.contact_email && (
                        <p className="text-xs text-gray-500">{bank.contact_email}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Broj kredita</p>
                    <p className="text-3xl font-bold text-blue-600">{bank.credits.length}</p>
                  </div>
                </div>

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
                    <p className="text-lg font-bold text-green-900">€{bank.total_repaid.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-xs text-red-700 mb-1">Dug banci</p>
                    <p className="text-lg font-bold text-red-900">€{bank.total_outstanding.toLocaleString('hr-HR')}</p>
                  </div>
                </div>

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
                                <h4 className="font-semibold text-gray-900">{credit.credit_type.replace('_', ' ').toUpperCase()}</h4>
                                <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${
                                  credit.credit_seniority === 'senior' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {credit.credit_seniority?.toUpperCase() || 'SENIOR'}
                                </span>
                                {credit.project && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    Projekat: {credit.project.name}
                                  </p>
                                )}
                                {credit.accounting_companies && (
                                  <p className="text-xs text-gray-500 mt-1">Company: {credit.accounting_companies.name}</p>
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
                                <span className="font-medium text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Iskorišteno:</span>
                                <span className="font-medium text-blue-600">€{usedAmount.toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Dostupno:</span>
                                <span className="font-medium text-green-600">€{available.toLocaleString('hr-HR')}</span>
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

                            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  creditUtilization >= 90 ? 'bg-red-500' :
                                  creditUtilization >= 70 ? 'bg-orange-500' :
                                  'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mb-3 text-right">{creditUtilization.toFixed(1)}%</p>

                            <div className="pt-3 border-t border-gray-200 flex gap-2">
                              <button
                                onClick={() => handleEditCredit(credit)}
                                className="flex-1 items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                              >
                                <Edit2 className="w-4 h-4 inline mr-2" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCredit(credit.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

      <BankCreditFormModal
        showCreditForm={showCreditForm}
        editingCredit={editingCredit}
        newCredit={newCredit}
        setNewCredit={setNewCredit}
        banks={banks}
        companies={companies}
        addCredit={addCredit}
        resetCreditForm={resetCreditForm}
      />
    </div>
  )
}

export default AccountingBanks
