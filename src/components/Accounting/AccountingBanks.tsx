import React from 'react'
import { Building2, CreditCard, DollarSign, TrendingUp, TrendingDown, Plus, Edit2, Trash2 } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, Button, Badge, StatCard, EmptyState } from '../ui'
import { useBanks } from './hooks/useBanks'
import BankCreditFormModal from './forms/BankCreditFormModal'
import EquityInvestmentFormModal from './forms/EquityInvestmentFormModal'

const AccountingBanks: React.FC = () => {
  const {
    banks,
    projects,
    companies,
    investors,
    loading,
    showCreditForm,
    setShowCreditForm,
    editingCredit,
    newCredit,
    setNewCredit,
    addCredit,
    handleEditCredit,
    handleDeleteCredit,
    resetCreditForm,
    showEquityForm,
    setShowEquityForm,
    fetchData
  } = useBanks()

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  const totalCreditAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_credit_limit, 0)
  const totalUsedAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_used, 0)
  const totalRepaidAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_repaid, 0)
  const totalOutstandingAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_outstanding, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banke"
        description="Pregled svih bankovnih kredita"
        actions={
          <div className="flex space-x-3">
            <Button variant="success" icon={Plus} onClick={() => setShowCreditForm(true)}>
              Add Credit
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setShowEquityForm(true)}>
              Add Equity
            </Button>
          </div>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Ukupan kredit limit" value={`€${totalCreditAcrossAllBanks.toLocaleString('hr-HR')}`} icon={CreditCard} />
        <StatCard label="Ukupno iskorišteno" value={`€${totalUsedAcrossAllBanks.toLocaleString('hr-HR')}`} icon={TrendingDown} color="blue" />
        <StatCard label="Ukupno vraćeno" value={`€${totalRepaidAcrossAllBanks.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
        <StatCard label="Ukupan dug" value={`€${totalOutstandingAcrossAllBanks.toLocaleString('hr-HR')}`} icon={DollarSign} color="red" />
      </StatGrid>

      {banks.length === 0 ? (
        <EmptyState icon={Building2} title="Nema banaka" description="Nema dodanih banaka u sustavu" />
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
                                <Badge variant={credit.credit_seniority === 'senior' ? 'blue' : 'orange'} size="sm" className="mt-1">
                                  {credit.credit_seniority?.toUpperCase() || 'SENIOR'}
                                </Badge>
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
                                <Badge variant="red" size="sm">ISTEKAO</Badge>
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
                              <Button variant="primary" icon={Edit2} className="flex-1" onClick={() => handleEditCredit(credit)}>
                                Edit
                              </Button>
                              <Button variant="danger" icon={Trash2} onClick={() => handleDeleteCredit(credit.id)} />
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

      <EquityInvestmentFormModal
        showEquityForm={showEquityForm}
        onClose={() => setShowEquityForm(false)}
        investors={investors}
        projects={projects}
        onSuccess={fetchData}
      />
    </div>
  )
}

export default AccountingBanks
