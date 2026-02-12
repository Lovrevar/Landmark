import React from 'react'
import { CreditCard, Plus, Calendar, Percent, DollarSign, Clock, Edit, Trash2 } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useCredits } from './hooks/useCredits'
import CreditFormModal from './forms/CreditFormModal'
import type { Credit } from './types/creditTypes'
import { PageHeader, LoadingSpinner, Button, Badge, Card, StatCard, StatGrid, EmptyState } from '../ui'

const CompanyCredits: React.FC = () => {
  const {
    credits,
    companies,
    projects,
    loading,
    showModal,
    editingCredit,
    formData,
    setFormData,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete
  } = useCredits()

  const getUtilizationPercentage = (credit: Credit) => {
    if (credit.amount === 0) return 0
    const usedAmount = credit.used_amount || 0
    return (usedAmount / credit.amount) * 100
  }

  const isExpiringSoon = (endDate: string) => {
    const daysUntilExpiry = differenceInDays(new Date(endDate), new Date())
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90
  }

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date()
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Credits"
        description="Manage company credit lines and loans"
        actions={
          <Button
            onClick={() => handleOpenModal()}
            variant="primary"
            icon={Plus}
          >
            Add Loan
          </Button>
        }
      />

      <div className="grid gap-6">
        {credits.map((credit) => {
          const utilizationPercent = getUtilizationPercentage(credit)
          const expiringSoon = isExpiringSoon(credit.maturity_date)
          const expired = isExpired(credit.maturity_date)
          const usedAmount = credit.used_amount || 0
          const remaining = credit.amount - usedAmount

          return (
            <Card key={credit.id} padding="lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-bold text-gray-900">{credit.credit_name}</h3>
                    {credit.project && (
                      <Badge variant="blue">{credit.project.name}</Badge>
                    )}
                    {expired && (
                      <Badge variant="red">EXPIRED</Badge>
                    )}
                    {!expired && expiringSoon && (
                      <Badge variant="orange">EXPIRING SOON</Badge>
                    )}
                  </div>
                  <p className="text-gray-600">
                    {credit.company.name} ({credit.company.oib})
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleOpenModal(credit)}
                    variant="ghost"
                    size="icon-md"
                    icon={Edit}
                    className="text-blue-600 hover:bg-blue-50"
                  />
                  <Button
                    onClick={() => handleDelete(credit.id)}
                    variant="outline-danger"
                    size="icon-md"
                    icon={Trash2}
                  />
                </div>
              </div>

              <StatGrid columns={5} className="mb-4">
                <StatCard
                  label="Credit Limit"
                  value={`€${credit.amount.toLocaleString('hr-HR')}`}
                  icon={DollarSign}
                  color="gray"
                  size="sm"
                />
                <StatCard
                  label="Used"
                  value={`€${usedAmount.toLocaleString('hr-HR')}`}
                  icon={DollarSign}
                  color="blue"
                  size="sm"
                />
                <StatCard
                  label="Repaid"
                  value={`€${(credit.repaid_amount || 0).toLocaleString('hr-HR')}`}
                  icon={DollarSign}
                  color="teal"
                  size="sm"
                />
                <StatCard
                  label="Available"
                  value={`€${remaining.toLocaleString('hr-HR')}`}
                  icon={DollarSign}
                  color="green"
                  size="sm"
                />
                <StatCard
                  label="Interest Rate"
                  value={`${credit.interest_rate}%`}
                  icon={Percent}
                  color="yellow"
                  size="sm"
                />
              </StatGrid>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Start Date:</span>
                  </span>
                  <p className="font-medium text-gray-900">{format(new Date(credit.start_date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Maturity Date:</span>
                  </span>
                  <p className="font-medium text-gray-900">{format(new Date(credit.maturity_date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Grace Period:</span>
                  </span>
                  <p className="font-medium text-gray-900">{Math.round(credit.grace_period / 30)} months</p>
                </div>
              </div>

              <div className="mt-4">
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
            </Card>
          )
        })}

        {credits.length === 0 && (
          <Card padding="none">
            <EmptyState
              icon={CreditCard}
              title="No Credits Yet"
              description="Add your first credit line to start tracking credit utilization"
              action={
                <Button
                  onClick={() => handleOpenModal()}
                  variant="primary"
                  icon={Plus}
                >
                  Add Credit
                </Button>
              }
            />
          </Card>
        )}
      </div>

      <CreditFormModal
        showModal={showModal}
        editingCredit={editingCredit}
        formData={formData}
        setFormData={setFormData}
        companies={companies}
        projects={projects}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
      />
    </div>
  )
}

export default CompanyCredits
