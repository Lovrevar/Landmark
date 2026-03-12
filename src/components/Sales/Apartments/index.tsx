import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { Home, Filter, Plus, Building2, Warehouse, Package, Link as LinkIcon } from 'lucide-react'
import { LoadingSpinner, SearchInput, Button, Select, EmptyState, Alert, PageHeader } from '../../ui'
import { ApartmentWithDetails, ApartmentFormData, BulkApartmentData, PaymentWithCustomer } from './types'
import * as apartmentService from './Services/apartmentService'
import { useApartmentData } from './hooks/useApartmentData'
import { BulkApartmentModal } from './Modals/BulkApartmentModal'
import { SingleApartmentModal } from './Modals/SingleApartmentModal'
import { EditApartmentModal } from './Modals/EditApartmentModal'
import { ApartmentDetailsModal } from './Modals/ApartmentDetailsModal'
import { PaymentHistoryModal } from './Modals/PaymentHistoryModal'
import { EditPaymentModal } from './Modals/EditPaymentModal'
import { LinkUnitsModal } from './Modals/LinkUnitsModal'

const ApartmentManagement: React.FC = () => {
  useAuth()
  const {
    apartments,
    projects,
    buildings,
    apartmentPaymentTotals,
    garagePaymentTotals,
    storagePaymentTotals,
    linkedGarages,
    linkedStorages,
    loading,
    refetch: fetchData
  } = useApartmentData()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

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
    const apt = apartments.find(a => a.id === id)
    const label = apt ? `Unit ${apt.number} (${apt.project_name} - ${apt.building_name})` : 'this apartment'
    if (!window.confirm(`Are you sure you want to delete ${label}? This action cannot be undone.`)) return

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
    return <LoadingSpinner message="Loading apartments..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apartments"
        description="Manage all apartments across projects"
        actions={
          <div className="flex items-center space-x-3">
            <div className="text-right mr-4">
              <p className="text-sm text-gray-600">Total Apartments</p>
              <p className="text-2xl font-bold text-gray-900">{apartments.length}</p>
            </div>
            <Button variant="success" icon={Plus} onClick={() => setShowBulkModal(true)}>
              Bulk Create Apartments
            </Button>
            <Button variant="primary" icon={Building2} onClick={() => setShowSingleModal(true)}>
              Add Single Apartment
            </Button>
          </div>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder="Search apartments..."
            />
          </div>

          <Select
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value)
              setFilterBuilding('all')
            }}
          >
            <option value="all">All Projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </Select>

          <Select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
          >
            <option value="all">All Buildings</option>
            {buildings
              .filter(b => filterProject === 'all' || b.project_id === filterProject)
              .map(building => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
          </Select>
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
        <EmptyState
          icon={Home}
          title="No Apartments Found"
          description="Try adjusting your filters"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApartments.map((apartment) => {
            const aptLinkedGarages = linkedGarages[apartment.id] || []
            const aptLinkedStorages = linkedStorages[apartment.id] || []

            const aptPaid = apartmentPaymentTotals[apartment.id] || 0
            const garagesTotalPaid = aptLinkedGarages.reduce((sum, g) => sum + (garagePaymentTotals[g.id] || 0), 0)
            const storagesTotalPaid = aptLinkedStorages.reduce((sum, s) => sum + (storagePaymentTotals[s.id] || 0), 0)

            const garagesTotalPrice = aptLinkedGarages.reduce((sum, g) => sum + (g.price || 0), 0)
            const storagesTotalPrice = aptLinkedStorages.reduce((sum, s) => sum + (s.price || 0), 0)
            const totalPrice = apartment.price + garagesTotalPrice + storagesTotalPrice
            const totalPaid = aptPaid + garagesTotalPaid + storagesTotalPaid
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
                    <span className="text-sm font-bold text-green-600">€{apartment.price.toLocaleString('hr-HR')}</span>
                  </div>

                  {(aptLinkedGarages.length > 0 || aptLinkedStorages.length > 0) && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Linked Units:</p>
                      {aptLinkedGarages.map((garage) => (
                        <div key={garage.id} className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span className="flex items-center">
                            <Warehouse className="w-3 h-3 mr-1 text-orange-600" />
                            Garage {garage.number}
                          </span>
                          <span className="font-medium text-orange-600">€{garage.price.toLocaleString('hr-HR')}</span>
                        </div>
                      ))}
                      {aptLinkedStorages.map((storage) => (
                        <div key={storage.id} className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span className="flex items-center">
                            <Package className="w-3 h-3 mr-1 text-gray-600" />
                            Storage {storage.number}
                          </span>
                          <span className="font-medium text-gray-600">€{storage.price.toLocaleString('hr-HR')}</span>
                        </div>
                      ))}
                      <div className="flex justify-between mt-1 pt-1 border-t border-gray-100">
                        <span className="text-xs font-semibold text-gray-700">Total Value:</span>
                        <span className="text-xs font-bold text-green-600">€{totalPrice.toLocaleString('hr-HR')}</span>
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
                          €{totalPaid.toLocaleString()} / €{totalPrice.toLocaleString('hr-HR')}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => openPaymentHistory(apartment)}
                  >
                    View Payments
                  </Button>
                  {(aptLinkedGarages.length === 0 || aptLinkedStorages.length === 0) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      icon={LinkIcon}
                      onClick={() => {
                        setSelectedApartment(apartment)
                        setShowLinkUnitsModal(true)
                      }}
                    >
                      Link Units
                    </Button>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedApartment(apartment)
                        setShowEditModal(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedApartment(apartment)
                        setShowDetailsModal(true)
                      }}
                    >
                      Details
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteApartment(apartment.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filteredApartments.length > 0 && (
        <Alert variant="info">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              <span className="font-medium">Filtered Results</span>
            </div>
            <div>
              Showing <span className="font-semibold">{filteredApartments.length}</span> of{' '}
              <span className="font-semibold">{apartments.length}</span> apartments
            </div>
          </div>
        </Alert>
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
        linkedGarages={selectedApartment ? (linkedGarages[selectedApartment.id] || []) : []}
        linkedStorages={selectedApartment ? (linkedStorages[selectedApartment.id] || []) : []}
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
