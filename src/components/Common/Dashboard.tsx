import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DirectorDashboard from '../dashboards/DirectorDashboard'
import SalesDashboard from '../dashboards/SalesDashboard'
import SupervisionDashboard from '../dashboards/SupervisionDashboard'
import InvestmentDashboard from '../dashboards/InvestmentDashboard'
import AccountingDashboard from '../dashboards/AccountingDashboard'

const Dashboard: React.FC = () => {
  const { currentProfile } = useAuth()

  const renderDashboard = () => {
    switch (currentProfile) {
      case 'General':
        return <DirectorDashboard key={currentProfile} />
      case 'Sales':
        return <SalesDashboard key={currentProfile} />
      case 'Supervision':
        return <SupervisionDashboard key={currentProfile} />
      case 'Funding':
        return <InvestmentDashboard key={currentProfile} />
      case 'Accounting':
        return <AccountingDashboard key={currentProfile} />
      default:
        return <DirectorDashboard key={currentProfile} />
    }
  }

  return (
    <div>
      
      {renderDashboard()}
    </div>
  )
}

export default Dashboard