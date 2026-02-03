import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { TrendingUp, AlertCircle, DollarSign, Users } from 'lucide-react'

interface DebtSummary {
  supplier_id: string
  supplier_name: string
  supplier_type: 'subcontractor' | 'retail_supplier' | 'office_supplier'
  total_unpaid: number
  total_paid: number
  invoice_count: number
}

const DebtStatus: React.FC = () => {
  const [debtData, setDebtData] = useState<DebtSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'unpaid' | 'paid'>('unpaid')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchDebtData()
  }, [])

  const fetchDebtData = async () => {
    try {
      setLoading(true)

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select(`
          id,
          supplier_id,
          retail_supplier_id,
          office_supplier_id,
          remaining_amount,
          paid_amount,
          status
        `)
        .in('status', ['UNPAID', 'PARTIALLY_PAID', 'PAID'])

      if (invoicesError) throw invoicesError

      const supplierIds = new Set<string>()
      const retailSupplierIds = new Set<string>()
      const officeSupplierIds = new Set<string>()

      ;(invoicesData || []).forEach(invoice => {
        if (invoice.supplier_id) supplierIds.add(invoice.supplier_id)
        if (invoice.retail_supplier_id) retailSupplierIds.add(invoice.retail_supplier_id)
        if (invoice.office_supplier_id) officeSupplierIds.add(invoice.office_supplier_id)
      })

      const [
        { data: suppliersData },
        { data: retailSuppliersData },
        { data: officeSuppliersData }
      ] = await Promise.all([
        supabase
          .from('subcontractors')
          .select('id, name')
          .in('id', Array.from(supplierIds)),
        supabase
          .from('retail_suppliers')
          .select('id, name')
          .in('id', Array.from(retailSupplierIds)),
        supabase
          .from('office_suppliers')
          .select('id, name')
          .in('id', Array.from(officeSupplierIds))
      ])

      const supplierMap = new Map<string, { name: string; type: 'subcontractor' | 'retail_supplier' | 'office_supplier' }>()

      ;(suppliersData || []).forEach(s => {
        supplierMap.set(s.id, { name: s.name, type: 'subcontractor' })
      })
      ;(retailSuppliersData || []).forEach(s => {
        supplierMap.set(s.id, { name: s.name, type: 'retail_supplier' })
      })
      ;(officeSuppliersData || []).forEach(s => {
        supplierMap.set(s.id, { name: s.name, type: 'office_supplier' })
      })

      const debtMap = new Map<string, {
        name: string
        type: 'subcontractor' | 'retail_supplier' | 'office_supplier'
        unpaid: number
        paid: number
        invoiceCount: number
      }>()

      ;(invoicesData || []).forEach(invoice => {
        const supplierId = invoice.supplier_id || invoice.retail_supplier_id || invoice.office_supplier_id
        if (!supplierId) return

        const supplierInfo = supplierMap.get(supplierId)
        if (!supplierInfo) return

        if (!debtMap.has(supplierId)) {
          debtMap.set(supplierId, {
            name: supplierInfo.name,
            type: supplierInfo.type,
            unpaid: 0,
            paid: 0,
            invoiceCount: 0
          })
        }

        const debt = debtMap.get(supplierId)!
        debt.invoiceCount++

        const paidAmount = parseFloat(invoice.paid_amount?.toString() || '0')
        const remainingAmount = parseFloat(invoice.remaining_amount?.toString() || '0')

        debt.paid += paidAmount

        if (invoice.status === 'UNPAID' || invoice.status === 'PARTIALLY_PAID') {
          debt.unpaid += remainingAmount
        }
      })

      const debtSummaries: DebtSummary[] = Array.from(debtMap.entries())
        .map(([id, data]) => ({
          supplier_id: id,
          supplier_name: data.name,
          supplier_type: data.type,
          total_unpaid: data.unpaid,
          total_paid: data.paid,
          invoice_count: data.invoiceCount
        }))
        .filter(d => d.total_unpaid > 0 || d.total_paid > 0)

      setDebtData(debtSummaries)
    } catch (error) {
      console.error('Error fetching debt data:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedData = [...debtData].sort((a, b) => {
    let compareValue = 0

    switch (sortBy) {
      case 'name':
        compareValue = a.supplier_name.localeCompare(b.supplier_name)
        break
      case 'unpaid':
        compareValue = a.total_unpaid - b.total_unpaid
        break
      case 'paid':
        compareValue = a.total_paid - b.total_paid
        break
    }

    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  const totalUnpaid = debtData.reduce((sum, d) => sum + d.total_unpaid, 0)
  const totalPaid = debtData.reduce((sum, d) => sum + d.total_paid, 0)
  const totalSuppliers = debtData.length
  const suppliersWithDebt = debtData.filter(d => d.total_unpaid > 0).length

  const handleSort = (field: 'name' | 'unpaid' | 'paid') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stanje duga</h1>
        <p className="text-sm text-gray-600 mt-1">Pregled svih neisplaćenih obveza prema dobavljačima</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <p className="text-2xl font-bold text-red-600">€{totalUnpaid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno isplaćeno</p>
              <p className="text-2xl font-bold text-green-600">€{totalPaid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

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
                        €{debt.total_unpaid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-green-600">
                        €{debt.total_paid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        €{(debt.total_unpaid + debt.total_paid).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" colSpan={3}>
                    UKUPNO
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                    €{totalUnpaid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                    €{totalPaid.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    €{(totalUnpaid + totalPaid).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
