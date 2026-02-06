import React from 'react'
import { TrendingUp, AlertCircle, DollarSign, Users, FileDown, FileSpreadsheet } from 'lucide-react'
import { useDebtStatus } from './hooks/useDebtStatus'
import { formatEuropeanNumber } from './services/debtService'
import { exportToExcel, exportToPDF } from './utils/debtExport'
import { PageHeader, StatGrid, LoadingSpinner } from '../ui'

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
    handleSort
  } = useDebtStatus()

  const getSupplierTypeBadge = (type: string) => {
    switch (type) {
      case 'retail_supplier':
        return <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">Retail</span>
      case 'office_supplier':
        return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">Office</span>
      default:
        return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">Site</span>
    }
  }

  const handleExportExcel = () => {
    exportToExcel(sortedData, totalUnpaid, totalPaid)
  }

  const handleExportPDF = () => {
    exportToPDF(sortedData, totalUnpaid, totalPaid, totalSuppliers, suppliersWithDebt)
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
            <button
              onClick={handleExportExcel}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </button>
          </>
        }
      />

      <StatGrid columns={4}>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno dobavljača</p>
              <p className="text-2xl font-bold text-gray-900">{totalSuppliers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dobavljači s dugom</p>
              <p className="text-2xl font-bold text-orange-600">{suppliersWithDebt}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno neisplaćeno</p>
              <p className="text-2xl font-bold text-red-600">€{formatEuropeanNumber(totalUnpaid)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno isplaćeno</p>
              <p className="text-2xl font-bold text-green-600">€{formatEuropeanNumber(totalPaid)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </StatGrid>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {debtData.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nema podataka o dugovima</h3>
            <p className="text-gray-600">Trenutno nema neisplaćenih računa</p>
          </div>
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Napomena:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Neisplaćeno = preostali iznos svih neplaćenih i djelomično plaćenih računa</li>
              <li>Isplaćeno = ukupan iznos svih izvršenih plaćanja za tog dobavljača</li>
              <li>Tablica uključuje sve tipove dobavljača: Site (gradilišni), Retail i Office</li>
              <li>Kliknite na zaglavlje stupca za sortiranje podataka</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DebtStatus
