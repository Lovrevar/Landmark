import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DirectorDashboard from '../Dashboards/DirectorDashboard'
import SalesDashboard from '../Dashboards/SalesDashboard'
import SupervisionDashboard from '../Dashboards/SupervisionDashboard'
import InvestmentDashboard from '../Dashboards/InvestmentDashboard'
import AccountingDashboard from '../Dashboards/AccountingDashboard'
import RetailDashboard from '../Dashboards/RetailDashboard'

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
      case 'Cashflow':
        return <AccountingDashboard key={currentProfile} />
      case 'Retail':
        return <RetailDashboard key={currentProfile} />
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