import React, { useState } from 'react'
import {
  Building2, CreditCard, DollarSign, TrendingUp, TrendingDown,
  Plus, ChevronDown, ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'
import { LoadingSpinner, PageHeader, StatGrid, Button, Badge, StatCard, EmptyState } from '../ui'
import { useBanks } from './hooks/useBanks'
import useBankeCredits from './hooks/useBankeCredits'
import BankCreditFormModal from './forms/BankCreditFormModal'
import AllocationRow from '../Finance/credits/AllocationRow'

const AccountingBanks: React.FC = () => {
  const {
    banks: banksMeta,
    projects,
    companies,
    loading: banksLoading,
    showCreditForm,
    setShowCreditForm,
    editingCredit,
    newCredit,
    setNewCredit,
    addCredit,
    resetCreditForm
  } = useBanks()

  const { banks, credits, allocations, loading: creditsLoading } = useBankeCredits()

  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set())
  const [expandedAllocations, setExpandedAllocations] = useState<Set<string>>(new Set())

  const loading = banksLoading || creditsLoading

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  const totalCreditAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_credit_limit, 0)
  const totalUsedAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_used, 0)
  const totalRepaidAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_repaid, 0)
  const totalOutstandingAcrossAllBanks = banksMeta.reduce((sum, b) => sum + b.total_outstanding, 0)

  const toggleBank = (bankId: string) => {
    setExpandedBanks((prev) => {
      const next = new Set(prev)
      if (next.has(bankId)) next.delete(bankId)
      else next.add(bankId)
      return next
    })
  }

  const toggleCredit = (creditId: string) => {
    setExpandedCredits((prev) => {
      const next = new Set(prev)
      if (next.has(creditId)) next.delete(creditId)
      else next.add(creditId)
      return next
    })
  }

  const toggleAllocation = (key: string) => {
    setExpandedAllocations((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteAllocation = (_allocationId: string, _creditId: string) => {
    // read-only view - allocations cannot be deleted from cashflow banke
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investicije"
        description="Pregled svih investicija"
        actions={
          <Button variant="success" icon={Plus} onClick={() => setShowCreditForm(true)}>
            Add Credit
          </Button>
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
        <div className="space-y-4">
          {banks.map((bank) => {
            const bankCredits = credits.filter((c) => c.bank_id === bank.id)
            if (bankCredits.length === 0) return null

            const isBankExpanded = expandedBanks.has(bank.id)
            const bankTotal = bankCredits.reduce((s, c) => s + c.amount, 0)
            const bankUsed = bankCredits.reduce((s, c) => s + c.used_amount, 0)
            const bankOutstanding = bankCredits.reduce((s, c) => s + c.outstanding_balance, 0)

            return (
              <div key={bank.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <button
                  onClick={() => toggleBank(bank.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-xl"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2.5 bg-blue-100 rounded-lg">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-gray-900">{bank.name}</h2>
                      <p className="text-sm text-gray-500">
                        {bankCredits.length} {bankCredits.length === 1 ? 'kredit' : 'kredita'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-8">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">Ukupno</p>
                      <p className="text-sm font-semibold text-gray-900">€{bankTotal.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">Iskorišteno</p>
                      <p className="text-sm font-semibold text-blue-600">€{bankUsed.toLocaleString('hr-HR')}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">Dug</p>
                      <p className="text-sm font-semibold text-red-600">€{bankOutstanding.toLocaleString('hr-HR')}</p>
                    </div>
                    {isBankExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isBankExpanded && (
                  <div className="border-t border-gray-200 p-5 space-y-4">
                    {bankCredits.map((credit) => {
                      const isExpanded = expandedCredits.has(credit.id)
                      const creditAllocations = allocations.get(credit.id) || []
                      const totalAllocated = creditAllocations.reduce((sum, a) => sum + a.allocated_amount, 0)
                      const unallocatedAmount = credit.amount - totalAllocated
                      const allocationPercentage = credit.amount > 0 ? (totalAllocated / credit.amount) * 100 : 0
                      const netUsed = credit.used_amount - credit.repaid_amount

                      return (
                        <div key={credit.id} className="bg-white rounded-xl border border-gray-200">
                          <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <button
                                  onClick={() => toggleCredit(credit.id)}
                                  className="p-3 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors duration-200"
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
                                    {credit.credit_type === 'equity' && (
                                      <Badge variant="purple">EQUITY</Badge>
                                    )}
                                    <Badge variant={
                                      credit.status?.toLowerCase() === 'active' ? 'green' :
                                      credit.status?.toLowerCase() === 'pending' ? 'yellow' :
                                      credit.status?.toLowerCase() === 'closed' ? 'gray' : 'blue'
                                    }>
                                      {credit.status}
                                    </Badge>
                                  </div>
                                  <p className="text-gray-600 mt-1">
                                    {bank.name}
                                    {credit.company && ` • ${credit.company.name}`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                                <p className="text-sm text-gray-600">Investment Amount</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-sm text-blue-700">Investment Amount</p>
                                <p className="text-lg font-bold text-blue-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                              </div>
                              <div className="bg-violet-50 p-3 rounded-lg">
                                <p className="text-sm text-violet-700">Allocated</p>
                                <p className="text-lg font-bold text-violet-900">€{totalAllocated.toLocaleString('hr-HR')}</p>
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
                              <div className={`p-3 rounded-lg ${unallocatedAmount < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                                <p className={`text-sm ${unallocatedAmount < 0 ? 'text-red-700' : 'text-green-700'}`}>Unallocated</p>
                                <p className={`text-lg font-bold ${unallocatedAmount < 0 ? 'text-red-900' : 'text-green-900'}`}>
                                  €{unallocatedAmount.toLocaleString('hr-HR')}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600">Allocation Progress</span>
                                <span className="text-sm font-medium">{allocationPercentage.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all duration-300 ${
                                    allocationPercentage > 100 ? 'bg-red-600' :
                                    allocationPercentage > 80 ? 'bg-orange-600' :
                                    'bg-blue-600'
                                  }`}
                                  style={{ width: `${Math.min(100, allocationPercentage)}%` }}
                                />
                              </div>
                              {allocationPercentage > 100 && (
                                <p className="text-xs text-red-600 mt-1">
                                  Over-allocated by €{(totalAllocated - credit.amount).toLocaleString('hr-HR')}
                                </p>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-4">
                                  <h4 className="font-semibold text-gray-900 flex items-center">
                                    <Building2 className="w-5 h-5 mr-2" />
                                    Credit Details
                                  </h4>
                                  <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Loan Type:</span>
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
                                    Dates &amp; Timeline
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

                              {creditAllocations.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                  <h4 className="font-semibold text-gray-900 mb-4">
                                    Namjene kredita ({creditAllocations.length})
                                  </h4>
                                  <div className="space-y-3">
                                    {creditAllocations.map((allocation) => {
                                      const allocationKey = `${credit.id}-${allocation.id}`
                                      return (
                                        <AllocationRow
                                          key={allocation.id}
                                          allocation={allocation}
                                          credit={credit}
                                          allocationKey={allocationKey}
                                          isExpanded={expandedAllocations.has(allocationKey)}
                                          onToggle={toggleAllocation}
                                          onDelete={handleDeleteAllocation}
                                        />
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

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
          })}
        </div>
      )}

      <BankCreditFormModal
        showCreditForm={showCreditForm}
        editingCredit={editingCredit}
        newCredit={newCredit}
        setNewCredit={setNewCredit}
        banks={banksMeta}
        companies={companies}
        addCredit={addCredit}
        resetCreditForm={resetCreditForm}
      />
    </div>
  )
}

export default AccountingBanks
