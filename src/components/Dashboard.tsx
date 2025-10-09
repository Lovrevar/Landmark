import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import DirectorDashboard from './dashboards/DirectorDashboard'
import AccountingDashboard from './dashboards/AccountingDashboard'
import SalesDashboard from './dashboards/SalesDashboard'
import SupervisionDashboard from './dashboards/SupervisionDashboard'
import InvestmentDashboard from './dashboards/InvestmentDashboard'

const Dashboard: React.FC = () => {
  const { user } = useAuth()

  const renderDashboard = () => {
    switch (user?.role) {
      case 'Director':
        return <DirectorDashboard key={user.id} />
      case 'Accounting':
        return <AccountingDashboard key={user.id} />
      case 'Sales':
        return <SalesDashboard key={user.id} />
      case 'Supervision':
        return <SupervisionDashboard key={user.id} />
      case 'Investment':
        return <InvestmentDashboard key={user.id} />
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