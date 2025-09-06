import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import DirectorDashboard from './dashboards/DirectorDashboard'
import AccountingDashboard from './dashboards/AccountingDashboard'
import SalesDashboard from './dashboards/SalesDashboard'
import SupervisionDashboard from './dashboards/SupervisionDashboard'

const Dashboard: React.FC = () => {
  const { user } = useAuth()

  const renderDashboard = () => {
    switch (user?.role) {
      case 'Director':
        return <DirectorDashboard />
      case 'Accounting':
        return <AccountingDashboard />
      case 'Sales':
        return <SalesDashboard />
      case 'Supervision':
        return <SupervisionDashboard />
      case 'Investment':
        return <InvestmentDashboard />
      default:
        return <div>Role not recognized</div>
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">{user?.role} Overview</p>
      </div>
      {renderDashboard()}
    </div>
  )
}

export default Dashboard