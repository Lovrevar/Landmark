import React, { useState, useEffect } from 'react'
import {
  Download,
  RefreshCw,
  BarChart3,
  TrendingUp,
  DollarSign,
  Briefcase
} from 'lucide-react'
import { PortfolioOverview } from '../Reports/PortfolioOverview'
import { ProjectPerformanceTable } from '../Reports/ProjectPerformanceTable'
import { SalesAnalysis } from '../Reports/SalesAnalysis'
import { CostAnalysis } from '../Reports/CostAnalysis'
import { generateRetailReportPdf } from '../Reports/pdf/retailReportPdf'
import { fetchRetailReportData } from '../Reports/services/retailReportService'
import type { RetailReportData } from '../Reports/retailReportTypes'
import { LoadingSpinner, PageHeader, Button, Tabs, EmptyState } from '../ui'

type TabId = 'overview' | 'projects' | 'sales' | 'costs'

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Pregled', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'projects', label: 'Projekti', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'sales', label: 'Prodaja', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'costs', label: 'Troškovi', icon: <DollarSign className="w-4 h-4" /> }
]

const RetailReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [data, setData] = useState<RetailReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const reportData = await fetchRetailReportData()
      setData(reportData)
    } catch (error) {
      console.error('Error loading retail report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPdf = async () => {
    if (!data) return
    try {
      setExporting(true)
      await generateRetailReportPdf(data)
    } catch (error) {
      console.error('Error generating PDF:', error)
    } finally {
      setExporting(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)

  if (loading) {
    return <LoadingSpinner message="Učitavanje izvještaja..." />
  }

  if (!data) {
    return (
      <EmptyState
        title="Greška pri učitavanju podataka."
        action={<Button onClick={loadData}>Pokušaj ponovo</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retail izvještaji"
        description={`${data.portfolio.total_projects} projekata \u00B7 ${data.portfolio.total_customers} kupaca \u00B7 ${data.portfolio.total_suppliers} dobavljača`}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={loadData} loading={loading}>Osvjezi</Button>
            <Button icon={Download} onClick={handleExportPdf} loading={exporting}>PDF izvještaj</Button>
          </>
        }
      />

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div>
        {activeTab === 'overview' && (
          <PortfolioOverview data={data} formatCurrency={formatCurrency} />
        )}
        {activeTab === 'projects' && (
          <ProjectPerformanceTable projects={data.projects} formatCurrency={formatCurrency} />
        )}
        {activeTab === 'sales' && (
          <SalesAnalysis
            customers={data.customers}
            invoices={data.invoices}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'costs' && (
          <CostAnalysis data={data} formatCurrency={formatCurrency} />
        )}
      </div>
    </div>
  )
}

export default RetailReports
