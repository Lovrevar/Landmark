import React, { useState, useEffect } from 'react'
import { supabase, Apartment, Project } from '../../lib/supabase'
import { Home, DollarSign, TrendingUp, Users } from 'lucide-react'

interface ApartmentWithProject extends Apartment {
  project_name: string
}

const SalesDashboard: React.FC = () => {
  const [apartments, setApartments] = useState<ApartmentWithProject[]>([])
  const [stats, setStats] = useState({
    totalApartments: 0,
    availableApartments: 0,
    soldApartments: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: apartmentsData, error } = await supabase
        .from('apartments')
        .select(`
          *,
          projects!inner(name)
        `)
        .order('project_id', { ascending: true })
        .order('floor', { ascending: true })
        .order('number', { ascending: true })

      if (error) throw error

      const apartmentsWithProject = (apartmentsData || []).map(apt => ({
        ...apt,
        project_name: apt.projects.name
      }))

      setApartments(apartmentsWithProject)

      // Calculate stats
      const totalApartments = apartmentsWithProject.length
      const availableApartments = apartmentsWithProject.filter(apt => apt.status === 'Available').length
      const soldApartments = apartmentsWithProject.filter(apt => apt.status === 'Sold').length
      const totalRevenue = apartmentsWithProject
        .filter(apt => apt.status === 'Sold')
        .reduce((sum, apt) => sum + apt.price, 0)

      setStats({ totalApartments, availableApartments, soldApartments, totalRevenue })
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateApartmentStatus = async (apartmentId: string, newStatus: string, buyerName?: string) => {
    const updateData: any = { status: newStatus }
    if (newStatus === 'Sold' && buyerName) {
      updateData.buyer_name = buyerName
    } else if (newStatus === 'Available') {
      updateData.buyer_name = null
    }

    const { error } = await supabase
      .from('apartments')
      .update(updateData)
      .eq('id', apartmentId)

    if (!error) {
      await fetchData()
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Units</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalApartments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Available</p>
              <p className="text-2xl font-bold text-gray-900">{stats.availableApartments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Sold</p>
              <p className="text-2xl font-bold text-gray-900">{stats.soldApartments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                €{stats.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Apartments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Apartment Sales Management</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Floor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size (m²)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Buyer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apartments.map((apartment) => (
                <tr key={apartment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {apartment.project_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {apartment.number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {apartment.floor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {apartment.size_m2}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{apartment.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                      apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {apartment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {apartment.buyer_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {apartment.status !== 'Sold' && (
                        <button
                          onClick={() => {
                            const buyerName = prompt('Enter buyer name:')
                            if (buyerName) {
                              updateApartmentStatus(apartment.id, 'Sold', buyerName)
                            }
                          }}
                          className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-xs font-medium transition-colors duration-200"
                        >
                          Mark Sold
                        </button>
                      )}
                      {apartment.status === 'Available' && (
                        <button
                          onClick={() => updateApartmentStatus(apartment.id, 'Reserved')}
                          className="px-3 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-md text-xs font-medium transition-colors duration-200"
                        >
                          Reserve
                        </button>
                      )}
                      {apartment.status !== 'Available' && (
                        <button
                          onClick={() => updateApartmentStatus(apartment.id, 'Available')}
                          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-xs font-medium transition-colors duration-200"
                        >
                          Make Available
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SalesDashboard