import React from 'react'
import { TrendingUp, AlertCircle, DollarSign, Users, FileDown, FileSpreadsheet, Filter } from 'lucide-react'
import { useDebtStatus } from './hooks/useDebtStatus'
import { formatEuropeanNumber } from './services/debtService'
import { exportToExcel, exportToPDF } from './utils/debtExport'
import { PageHeader, StatGrid, StatCard, LoadingSpinner, Button, Badge, EmptyState, Alert, Select } from '../ui'

const DebtStatus: React.FC = () => {
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
        return <Badge variant="teal" size="sm">Retail</Badge>
      case 'office_supplier':
        return <Badge variant="blue" size="sm">Office</Badge>
      case 'mixed':
        return <Badge variant="purple" size="sm">Mixed</Badge>
      default:
        return <Badge variant="gray" size="sm">Site</Badge>
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
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stanje duga"
        description="Pregled svih neisplaćenih obveza prema dobavljačima"
        actions={
          <>
            <Button variant="success" icon={FileSpreadsheet} onClick={handleExportExcel}>
              Export Excel
            </Button>
            <Button variant="danger" icon={FileDown} onClick={handleExportPDF}>
              Export PDF
            </Button>
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Ukupno dobavljača"
          value={totalSuppliers}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Dobavljači s dugom"
          value={suppliersWithDebt}
          icon={AlertCircle}
          color="yellow"
        />
        <StatCard
          label="Ukupno neisplaćeno"
          value={`€${formatEuropeanNumber(totalUnpaid)}`}
          icon={TrendingUp}
          color="red"
        />
        <StatCard
          label="Ukupno isplaćeno"
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
              Filtriraj po projektu
            </label>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full max-w-md"
            >
              <option value="">Svi projekti</option>
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
              Poništi filter
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {debtData.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="Nema podataka o dugovima"
            description="Trenutno nema neisplaćenih računa"
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
                      <span>Firma</span>
                      {sortBy === 'name' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tip
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Računi
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('unpaid')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Neisplaćeno</span>
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
                      <span>Isplaćeno</span>
                      {sortBy === 'paid' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ukupno
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
                    UKUPNO
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

      <Alert variant="info" title="Napomena:">
        <ul className="list-disc list-inside space-y-1">
          <li>Neisplaćeno = preostali iznos svih neplaćenih i djelomično plaćenih računa</li>
          <li>Isplaćeno = ukupan iznos svih izvršenih plaćanja za tog dobavljača</li>
          <li>Dobavljači s istim imenom grupirani su i zbrojeni bez obzira na tip (Site, Retail, Office)</li>
          <li>Tip "Mixed" označava da se dobavljač pojavljuje u više kategorija</li>
          <li>Koristite filter za prikaz dugovanja samo za određeni projekt</li>
          <li>Kliknite na zaglavlje stupca za sortiranje podataka</li>
        </ul>
      </Alert>
    </div>
  )
}

export default DebtStatus
