import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Home, Search, Filter } from 'lucide-react'

interface ApartmentListItem {
  id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: string
  buyer_name: string | null
  project_name: string
  building_name: string
  project_id: string
  building_id: string
}

const ApartmentManagement: React.FC = () => {
  const [apartments, setApartments] = useState<ApartmentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')
        .order('number')

      if (apartmentsError) throw apartmentsError

      const projectIds = [...new Set(apartmentsData?.map((a: any) => a.project_id) || [])]
      const buildingIds = [...new Set(apartmentsData?.map((a: any) => a.building_id).filter(Boolean) || [])]

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds)

      const { data: buildingsData } = await supabase
        .from('buildings')
        .select('id, name')
        .in('id', buildingIds)

      setProjects(projectsData || [])
      setBuildings(buildingsData || [])

      const apartmentsWithDetails: ApartmentListItem[] = (apartmentsData || []).map((apt: any) => {
        const project = projectsData?.find(p => p.id === apt.project_id)
        const building = buildingsData?.find(b => b.id === apt.building_id)

        return {
          id: apt.id,
          number: apt.number,
          floor: apt.floor,
          size_m2: apt.size_m2,
          price: apt.price,
          status: apt.status,
          buyer_name: apt.buyer_name,
          project_name: project?.name || 'Unknown Project',
          building_name: building?.name || 'No Building',
          project_id: apt.project_id,
          building_id: apt.building_id || ''
        }
      })

      setApartments(apartmentsWithDetails)
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredApartments = apartments.filter(apt => {
    const matchesSearch =
      apt.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.building_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesProject = filterProject === 'all' || apt.project_id === filterProject
    const matchesBuilding = filterBuilding === 'all' || apt.building_id === filterBuilding
    const matchesStatus = filterStatus === 'all' || apt.status === filterStatus

    return matchesSearch && matchesProject && matchesBuilding && matchesStatus
  })

  if (loading) {
    return <div className="text-center py-12">Loading apartments...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Apartments</h1>
          <p className="text-gray-600 mt-2">Browse all apartments across projects</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Apartments</p>
          <p className="text-2xl font-bold text-gray-900">{apartments.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search apartments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <select
              value={filterProject}
              onChange={(e) => {
                setFilterProject(e.target.value)
                setFilterBuilding('all')
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Projects</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterBuilding}
              onChange={(e) => setFilterBuilding(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Buildings</option>
              {buildings
                .filter(b => filterProject === 'all' || apartments.some(a => a.building_id === b.id && a.project_id === filterProject))
                .map(building => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              filterStatus === 'all'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('Available')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              filterStatus === 'Available'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setFilterStatus('Reserved')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              filterStatus === 'Reserved'
                ? 'bg-yellow-100 text-yellow-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Reserved
          </button>
          <button
            onClick={() => setFilterStatus('Sold')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              filterStatus === 'Sold'
                ? 'bg-green-100 text-green-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sold
          </button>
        </div>
      </div>

      {filteredApartments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Apartments Found</h3>
          <p className="text-gray-600">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Floor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApartments.map((apartment) => (
                  <tr key={apartment.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Home className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{apartment.number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {apartment.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {apartment.building_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {apartment.floor}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {apartment.size_m2} m²
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      €{apartment.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        apartment.status === 'Available' ? 'bg-blue-100 text-blue-800' :
                        apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                        apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {apartment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {apartment.buyer_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredApartments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">Filtered Results</span>
            </div>
            <div className="text-sm text-blue-900">
              Showing <span className="font-semibold">{filteredApartments.length}</span> of{' '}
              <span className="font-semibold">{apartments.length}</span> apartments
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApartmentManagement
