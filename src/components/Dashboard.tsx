import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import DirectorDashboard from './dashboards/DirectorDashboard'
import SalesDashboard from './dashboards/SalesDashboard'
import SupervisionDashboard from './dashboards/SupervisionDashboard'
import InvestmentDashboard from './dashboards/InvestmentDashboard'

const Dashboard: React.FC = () => {
  const { currentProfile } = useAuth()

  const renderDashboard = () => {
    switch (currentProfile) {
      case 'Director':
        return <DirectorDashboard key={currentProfile} />
      case 'Salesperson':
        return <SalesDashboard key={currentProfile} />
      case 'Supervisor':
        return <SupervisionDashboard key={currentProfile} />
      case 'Investor':
        return <InvestmentDashboard key={currentProfile} />
      default:
        return <DirectorDashboard key={currentProfile} />
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">{currentProfile} Overview</p>
      </div>
      {renderDashboard()}
    </div>
  )
}

export default Dashboard