import React, { useState, useEffect } from 'react'
import {
  Download,
  RefreshCw,
  BarChart3,
  TrendingUp,
  DollarSign,
  Briefcase
} from 'lucide-react'
import { PortfolioOverview } from './reports/PortfolioOverview'
import { ProjectPerformanceTable } from './reports/ProjectPerformanceTable'
import { SalesAnalysis } from './reports/SalesAnalysis'
import { CostAnalysis } from './reports/CostAnalysis'
import { generateRetailReportPdf } from './reports/retailReportPdf'
import { fetchRetailReportData } from './reports/retailReportService'
import type { RetailReportData } from './reports/retailReportTypes'

type TabId = 'overview' | 'projects' | 'sales' | 'costs'

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Pregled', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'projects', label: 'Projekti', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'sales', label: 'Prodaja', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'costs', label: 'Troskovi', icon: <DollarSign className="w-4 h-4" /> }
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Ucitavanje izvjestaja...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Greska pri ucitavanju podataka.</p>
        <button
          onClick={loadData}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Pokusaj ponovo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retail izvjestaji</h1>
          <p className="text-sm text-gray-600 mt-1">
            {data.portfolio.total_projects} projekata &middot; {data.portfolio.total_customers} kupaca &middot; {data.portfolio.total_suppliers} dobavljaca
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Osvjezi
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generiranje...' : 'PDF izvjestaj'}
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

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
