import React from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, AlertCircle, DollarSign, Users, FileDown, FileSpreadsheet, Filter } from 'lucide-react'
import { useDebtStatus } from './hooks/useDebtStatus'
import { formatEuropeanNumber } from './services/debtService'
import { exportToExcel, exportToPDF } from './services/debtExport'
import { PageHeader, StatGrid, StatCard, LoadingSpinner, Button, Badge, EmptyState, Alert, Select } from '../../ui'

const DebtStatus: React.FC = () => {
  const { t } = useTranslation()
  const {
    debtData,
    loading,
    sortBy,
    sortOrder,
    sortedData,
    totalUnpaid,
    totalPaid,
    totalSuppliers,
    suppliersWithDebt,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    handleSort
  } = useDebtStatus()

  const getSupplierTypeBadge = (type: string) => {
    switch (type) {
      case 'retail_supplier':
        return <Badge variant="teal" size="sm">{t('debt_status.supplier_types.retail')}</Badge>
      case 'office_supplier':
        return <Badge variant="blue" size="sm">{t('debt_status.supplier_types.office')}</Badge>
      case 'mixed':
        return <Badge variant="purple" size="sm">{t('debt_status.supplier_types.mixed')}</Badge>
      default:
        return <Badge variant="gray" size="sm">{t('debt_status.supplier_types.site')}</Badge>
    }
  }

  const getSelectedProjectName = () => {
    if (!selectedProjectId) return null
    const project = projects.find(p => p.id === selectedProjectId)
    return project ? project.name : null
  }

  const handleExportExcel = () => {
    exportToExcel(sortedData, totalUnpaid, totalPaid, getSelectedProjectName())
  }

  const handleExportPDF = () => {
    exportToPDF(sortedData, totalUnpaid, totalPaid, totalSuppliers, suppliersWithDebt, getSelectedProjectName())
  }

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('debt_status.title')}
        description={t('debt_status.description')}
        actions={
          <>
            <Button variant="success" icon={FileSpreadsheet} onClick={handleExportExcel}>
              {t('common.export_excel')}
            </Button>
            <Button variant="danger" icon={FileDown} onClick={handleExportPDF}>
              {t('common.export_pdf')}
            </Button>
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label={t('debt_status.stats.total_suppliers')}
          value={totalSuppliers}
          icon={Users}
          color="blue"
        />
        <StatCard
          label={t('debt_status.stats.suppliers_with_debt')}
          value={suppliersWithDebt}
          icon={AlertCircle}
          color="yellow"
        />
        <StatCard
          label={t('debt_status.stats.total_unpaid')}
          value={`€${formatEuropeanNumber(totalUnpaid)}`}
          icon={TrendingUp}
          color="red"
        />
        <StatCard
          label={t('debt_status.stats.total_paid')}
          value={`€${formatEuropeanNumber(totalPaid)}`}
          icon={DollarSign}
          color="green"
        />
      </StatGrid>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('debt_status.filter_label')}
            </label>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full max-w-md"
            >
              <option value="">{t('debt_status.all_projects')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.type === 'retail' ? '(Retail)' : '(Site)'}
                </option>
              ))}
            </Select>
          </div>
          {selectedProjectId && (
            <Button
              variant="secondary"
              onClick={() => setSelectedProjectId('')}
              className="mt-6"
            >
              {t('debt_status.clear_filter')}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {debtData.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title={t('debt_status.empty.title')}
            description={t('debt_status.empty.description')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('debt_status.table.supplier')}</span>
                      {sortBy === 'name' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('debt_status.table.type')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('debt_status.table.invoices')}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('unpaid')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>{t('debt_status.table.unpaid')}</span>
                      {sortBy === 'unpaid' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('paid')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>{t('debt_status.table.paid')}</span>
                      {sortBy === 'paid' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('debt_status.table.total')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedData.map((debt) => (
                  <tr key={debt.supplier_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{debt.supplier_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSupplierTypeBadge(debt.supplier_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{debt.invoice_count}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-semibold ${debt.total_unpaid > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        €{formatEuropeanNumber(debt.total_unpaid)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-green-600">
                        €{formatEuropeanNumber(debt.total_paid)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        €{formatEuropeanNumber(debt.total_unpaid + debt.total_paid)}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" colSpan={3}>
                    {t('debt_status.table.grand_total')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                    €{formatEuropeanNumber(totalUnpaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                    €{formatEuropeanNumber(totalPaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    €{formatEuropeanNumber(totalUnpaid + totalPaid)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Alert variant="info" title={t('debt_status.note_title')}>
        <ul className="list-disc list-inside space-y-1">
          <li>{t('debt_status.note_unpaid')}</li>
          <li>{t('debt_status.note_paid')}</li>
          <li>{t('debt_status.note_grouped')}</li>
          <li>{t('debt_status.note_mixed')}</li>
          <li>{t('debt_status.note_filter')}</li>
          <li>{t('debt_status.note_sort')}</li>
        </ul>
      </Alert>
    </div>
  )
}

export default DebtStatus
