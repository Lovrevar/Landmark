import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Home, Search, Filter, DollarSign, Plus, Building2, Warehouse, Package, Link as LinkIcon } from 'lucide-react'
import { ApartmentWithDetails, ApartmentFormData, BulkApartmentData, PaymentWithCustomer } from './Apartments/types/apartmentTypes'
import * as apartmentService from './Apartments/services/apartmentService'
import { BulkApartmentModal } from './Apartments/forms/BulkApartmentModal'
import { SingleApartmentModal } from './Apartments/forms/SingleApartmentModal'
import { EditApartmentModal } from './Apartments/forms/EditApartmentModal'
import { ApartmentDetailsModal } from './Apartments/forms/ApartmentDetailsModal'
import { PaymentHistoryModal } from './Apartments/forms/PaymentHistoryModal'
import { EditPaymentModal } from './Apartments/forms/EditPaymentModal'
import { LinkUnitsModal } from './Apartments/forms/LinkUnitsModal'

const ApartmentManagement: React.FC = () => {
  const { user } = useAuth()
  const [apartments, setApartments] = useState<ApartmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string; project_id: string }>>([])

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showSingleModal, setShowSingleModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [showLinkUnitsModal, setShowLinkUnitsModal] = useState(false)

  const [selectedApartment, setSelectedApartment] = useState<ApartmentWithDetails | null>(null)
  const [payments, setPayments] = useState<PaymentWithCustomer[]>([])
  const [editingPayment, setEditingPayment] = useState<PaymentWithCustomer | null>(null)
  const [apartmentPaymentTotals, setApartmentPaymentTotals] = useState<Record<string, number>>({})
  const [garagePaymentTotals, setGaragePaymentTotals] = useState<Record<string, number>>({})
  const [storagePaymentTotals, setStoragePaymentTotals] = useState<Record<string, number>>({})
  const [linkedGarages, setLinkedGarages] = useState<Record<string, any>>({})
  const [linkedStorages, setLinkedStorages] = useState<Record<string, any>>({})

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

      const { data: allProjects } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      const { data: allBuildings } = await supabase
        .from('buildings')
        .select('id, name, project_id')
        .order('name')

      setProjects(allProjects || [])
      setBuildings(allBuildings || [])

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

      // Fetch payments from new accounting system
      const { data: paymentsData } = await supabase
        .from('accounting_payments')
        .select(`
          amount,
          invoice:accounting_invoices!inner(
            apartment_id
          )
        `)
        .not('invoice.apartment_id', 'is', null)

      const aptPaymentTotals: Record<string, number> = {}
      const garPaymentTotals: Record<string, number> = {}
      const storPaymentTotals: Record<string, number> = {}

      if (paymentsData) {
        paymentsData.forEach((payment: any) => {
          const apartmentId = payment.invoice?.apartment_id
          if (apartmentId) {
            if (!aptPaymentTotals[apartmentId]) {
              aptPaymentTotals[apartmentId] = 0
            }
            aptPaymentTotals[apartmentId] += parseFloat(payment.amount)
          }
        })
      }
      setApartmentPaymentTotals(aptPaymentTotals)
      setGaragePaymentTotals(garPaymentTotals)
      setStoragePaymentTotals(storPaymentTotals)

      const garageIds = [...new Set(apartmentsData?.map((a: any) => a.garage_id).filter(Boolean) || [])]
      const storageIds = [...new Set(apartmentsData?.map((a: any) => a.repository_id).filter(Boolean) || [])]

      const garagesMap: Record<string, any> = {}
      const storagesMap: Record<string, any> = {}

      if (garageIds.length > 0) {
        const { data: garagesData } = await supabase
          .from('garages')
          .select('id, number, size_m2, price')
          .in('id', garageIds)

        const garageById: Record<string, any> = {}
        garagesData?.forEach((g: any) => {
          garageById[g.id] = g
        })

        apartmentsData?.forEach((apt: any) => {
          if (apt.garage_id && garageById[apt.garage_id]) {
            garagesMap[apt.id] = garageById[apt.garage_id]
          }
        })
      }

      if (storageIds.length > 0) {
        const { data: storagesData } = await supabase
          .from('repositories')
          .select('id, number, size_m2, price')
          .in('id', storageIds)

        const storageById: Record<string, any> = {}
        storagesData?.forEach((s: any) => {
          storageById[s.id] = s
        })

        apartmentsData?.forEach((apt: any) => {
          if (apt.repository_id && storageById[apt.repository_id]) {
            storagesMap[apt.id] = storageById[apt.repository_id]
          }
        })
      }

      setLinkedGarages(garagesMap)
      setLinkedStorages(storagesMap)

      const apartmentsWithDetails: ApartmentWithDetails[] = (apartmentsData || []).map((apt: any) => {
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

  const handleCreateBulk = async (data: BulkApartmentData) => {
    try {
      await apartmentService.createBulkApartments(data)
      setShowBulkModal(false)
      fetchData()
    } catch (error) {
      console.error('Error creating apartments:', error)
 
    }
  }

  const handleCreateSingle = async (data: ApartmentFormData) => {
    try {
      await apartmentService.createSingleApartment(data)
      setShowSingleModal(false)
      fetchData()

    } catch (error) {
      console.error('Error creating apartment:', error)

    }
  }

  const handleUpdateApartment = async (id: string, updates: Partial<ApartmentWithDetails>) => {
    try {
      await apartmentService.updateApartment(id, updates)
      setShowEditModal(false)
      setSelectedApartment(null)
      fetchData()
    } catch (error) {
      console.error('Error updating apartment:', error)
    }
  }

  const handleDeleteApartment = async (id: string) => {

    try {
      await apartmentService.deleteApartment(id)
      fetchData()
    } catch (error) {
      console.error('Error deleting apartment:', error)
    }
  }


  const openPaymentHistory = async (apartment: ApartmentWithDetails) => {
    try {
      const paymentsData = await apartmentService.fetchApartmentPayments(apartment.id)
      setPayments(paymentsData)
      setSelectedApartment(apartment)
      setShowPaymentHistory(true)
    } catch (error) {
      console.error('Error fetching payments:', error)
    }
  }

  const handleUpdatePayment = async (
    paymentId: string,
    amount: number,
    date: string,
    paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other',
    notes: string
  ) => {
    if (!selectedApartment) return

    try {
      const { data: sale } = await supabase
        .from('sales')
        .select('id')
        .eq('apartment_id', selectedApartment.id)
        .maybeSingle()

      await apartmentService.updatePayment(paymentId, amount, date, paymentType, notes, sale?.id || null)
      setShowEditPaymentModal(false)
      setEditingPayment(null)
      const paymentsData = await apartmentService.fetchApartmentPayments(selectedApartment.id)
      setPayments(paymentsData)
      fetchData()
    } catch (error) {
      console.error('Error updating payment:', error)
    }
  }

  const handleDeletePayment = async (paymentId: string, saleId: string | null, amount: number) => {
    if (!selectedApartment) return

    try {
      await apartmentService.deletePayment(paymentId, saleId, amount)
      const paymentsData = await apartmentService.fetchApartmentPayments(selectedApartment.id)
      setPayments(paymentsData)
      fetchData()
    } catch (error) {
      console.error('Error deleting payment:', error)
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
          <p className="text-gray-600 mt-2">Manage all apartments across projects</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right mr-4">
            <p className="text-sm text-gray-600">Total Apartments</p>
            <p className="text-2xl font-bold text-gray-900">{apartments.length}</p>
          </div>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Bulk Create Apartments
          </button>
          <button
            onClick={() => setShowSingleModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Add Single Apartment
          </button>
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
                .filter(b => filterProject === 'all' || b.project_id === filterProject)
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApartments.map((apartment) => {
            const linkedGarage = linkedGarages[apartment.id]
            const linkedStorage = linkedStorages[apartment.id]

            const aptPaid = apartmentPaymentTotals[apartment.id] || 0
            const garagePaid = linkedGarage ? (garagePaymentTotals[linkedGarage.id] || 0) : 0
            const storagePaid = linkedStorage ? (storagePaymentTotals[linkedStorage.id] || 0) : 0

            const totalPrice = apartment.price + (linkedGarage?.price || 0) + (linkedStorage?.price || 0)
            const totalPaid = aptPaid + garagePaid + storagePaid
            const overallPercentage = totalPrice > 0 ? (totalPaid / totalPrice) * 100 : 0

            return (
              <div
                key={apartment.id}
                className={`rounded-xl shadow-sm border p-4 transition-all duration-200 ${
                  apartment.status === 'Sold'
                    ? 'border-green-200 bg-green-50'
                    : apartment.status === 'Reserved'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-gray-200 bg-white hover:shadow-md'
                }`}
              >
                <div className="mb-3">
                  <h4 className="font-semibold text-gray-900">Unit {apartment.number}</h4>
                  <p className="text-sm text-gray-600">Floor {apartment.floor}</p>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Project:</span>
                    <span className="text-sm font-medium">{apartment.project_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Building:</span>
                    <span className="text-sm font-medium">{apartment.building_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Size:</span>
                    <span className="text-sm font-medium">{apartment.size_m2} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Price:</span>
                    <span className="text-sm font-bold text-green-600">€{apartment.price.toLocaleString()}</span>
                  </div>

                  {(linkedGarage || linkedStorage) && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Linked Units:</p>
                      {linkedGarage && (
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span className="flex items-center">
                            <Warehouse className="w-3 h-3 mr-1 text-orange-600" />
                            Garage {linkedGarage.number}
                          </span>
                          <span className="font-medium text-orange-600">€{linkedGarage.price.toLocaleString()}</span>
                        </div>
                      )}
                      {linkedStorage && (
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span className="flex items-center">
                            <Package className="w-3 h-3 mr-1 text-gray-600" />
                            Storage {linkedStorage.number}
                          </span>
                          <span className="font-medium text-gray-600">€{linkedStorage.price.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between mt-1 pt-1 border-t border-gray-100">
                        <span className="text-xs font-semibold text-gray-700">Total Value:</span>
                        <span className="text-xs font-bold text-green-600">€{totalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {apartment.status === 'Sold' && apartment.buyer_name && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Buyer:</span>
                        <span className="text-sm font-medium">{apartment.buyer_name}</span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700">Overall Progress</span>
                          <span className="text-xs font-bold">{overallPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all duration-300 ${
                              overallPercentage >= 100 ? 'bg-green-600' :
                              overallPercentage >= 50 ? 'bg-blue-600' :
                              'bg-orange-600'
                            }`}
                            style={{
                              width: `${Math.min(100, overallPercentage)}%`
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 font-medium">
                          €{totalPaid.toLocaleString()} / €{totalPrice.toLocaleString()}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => openPaymentHistory(apartment)}
                    className="w-full px-3 py-2 bg-teal-600 text-white rounded-md text-xs font-medium hover:bg-teal-700 transition-colors duration-200 flex items-center justify-center"
                  >
                    View Payments
                  </button>
                  {(!linkedGarage || !linkedStorage) && (
                    <button
                      onClick={() => {
                        setSelectedApartment(apartment)
                        setShowLinkUnitsModal(true)
                      }}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors duration-200 flex items-center justify-center"
                    >
                      <LinkIcon className="w-3 h-3 mr-1" />
                      Link Units
                    </button>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setSelectedApartment(apartment)
                        setShowEditModal(true)
                      }}
                      className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedApartment(apartment)
                        setShowDetailsModal(true)
                      }}
                      className="px-2 py-1 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 transition-colors duration-200"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => handleDeleteApartment(apartment.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors duration-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
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

      <BulkApartmentModal
        visible={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        projects={projects}
        buildings={buildings}
        onSubmit={handleCreateBulk}
      />

      <SingleApartmentModal
        visible={showSingleModal}
        onClose={() => setShowSingleModal(false)}
        projects={projects}
        buildings={buildings}
        onSubmit={handleCreateSingle}
      />

      <EditApartmentModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedApartment(null)
        }}
        apartment={selectedApartment}
        onSubmit={handleUpdateApartment}
      />

      <ApartmentDetailsModal
        visible={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setSelectedApartment(null)
        }}
        apartment={selectedApartment}
      />

      <PaymentHistoryModal
        visible={showPaymentHistory}
        onClose={() => {
          setShowPaymentHistory(false)
          setSelectedApartment(null)
          setPayments([])
        }}
        apartment={selectedApartment}
        payments={payments}
        linkedGarage={selectedApartment ? linkedGarages[selectedApartment.id] : null}
        linkedStorage={selectedApartment ? linkedStorages[selectedApartment.id] : null}
        onEditPayment={(payment) => {
          setEditingPayment(payment)
          setShowEditPaymentModal(true)
        }}
        onDeletePayment={handleDeletePayment}
      />

      <EditPaymentModal
        visible={showEditPaymentModal}
        onClose={() => {
          setShowEditPaymentModal(false)
          setEditingPayment(null)
        }}
        payment={editingPayment}
        onSubmit={handleUpdatePayment}
      />

      <LinkUnitsModal
        visible={showLinkUnitsModal}
        onClose={() => {
          setShowLinkUnitsModal(false)
          setSelectedApartment(null)
        }}
        apartment={selectedApartment}
        onLink={fetchData}
      />
    </div>
  )
}

export default ApartmentManagement
