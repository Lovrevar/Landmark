import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../contexts/AuthContext'
import { Home, Filter, Plus, Building2, Warehouse, Package, Link as LinkIcon } from 'lucide-react'
import { LoadingSpinner, SearchInput, Button, Select, EmptyState, Alert, PageHeader, ConfirmDialog } from '../../ui'
import { ApartmentWithDetails, ApartmentFormData, BulkApartmentData, PaymentWithCustomer } from './types'
import * as apartmentService from './services/apartmentService'
import { useApartmentData } from './hooks/useApartmentData'
import { BulkApartmentModal } from './modals/BulkApartmentModal'
import { SingleApartmentModal } from './modals/SingleApartmentModal'
import { EditApartmentModal } from './modals/EditApartmentModal'
import { ApartmentDetailsModal } from './modals/ApartmentDetailsModal'
import { PaymentHistoryModal } from './modals/PaymentHistoryModal'
import { EditPaymentModal } from './modals/EditPaymentModal'
import { LinkUnitsModal } from './modals/LinkUnitsModal'

const ApartmentManagement: React.FC = () => {
  const { t } = useTranslation()
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
  const [pendingDeleteApartmentId, setPendingDeleteApartmentId] = useState<string | null>(null)
  const [deletingApartment, setDeletingApartment] = useState(false)

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

  const handleDeleteApartment = (id: string) => {
    setPendingDeleteApartmentId(id)
  }

  const confirmDeleteApartment = async () => {
    if (!pendingDeleteApartmentId) return
    setDeletingApartment(true)
    try {
      await apartmentService.deleteApartment(pendingDeleteApartmentId)
      fetchData()
    } catch (error) {
      console.error('Error deleting apartment:', error)
    } finally {
      setDeletingApartment(false)
      setPendingDeleteApartmentId(null)
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
      const saleId = await apartmentService.fetchSaleIdForApartment(selectedApartment.id)
      await apartmentService.updatePayment(paymentId, amount, date, paymentType, notes, saleId)
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
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('apartments.title')}
        description={t('apartments.subtitle')}
        actions={
          <div className="flex items-center space-x-3">
            <div className="text-right mr-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('apartments.title')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{apartments.length}</p>
            </div>
            <Button variant="success" icon={Plus} onClick={() => setShowBulkModal(true)}>
              {t('apartments.bulk_create')}
            </Button>
            <Button variant="primary" icon={Building2} onClick={() => setShowSingleModal(true)}>
              {t('apartments.add')}
            </Button>
          </div>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder={t('apartments.search')}
            />
          </div>

          <Select
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value)
              setFilterBuilding('all')
            }}
          >
            <option value="all">{t('apartments.form.select_project')}</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </Select>

          <Select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
          >
            <option value="all">{t('apartments.form.select_building')}</option>
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
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('common.status')}
          </button>
          <button
            onClick={() => setFilterStatus('Available')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              filterStatus === 'Available'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('apartments.statuses.available')}
          </button>
          <button
            onClick={() => setFilterStatus('Reserved')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              filterStatus === 'Reserved'
                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-medium'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('apartments.statuses.reserved')}
          </button>
          <button
            onClick={() => setFilterStatus('Sold')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              filterStatus === 'Sold'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('apartments.statuses.sold')}
          </button>
        </div>
      </div>

      {filteredApartments.length === 0 ? (
        <EmptyState
          icon={Home}
          title={t('common.no_data')}
          description={t('apartments.search')}
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
                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                    : apartment.status === 'Reserved'
                      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md'
                }`}
              >
                <div className="mb-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Unit {apartment.number}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.floor')} {apartment.floor}</p>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.project')}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{apartment.project_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.building')}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{apartment.building_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('apartments.table.size')}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{apartment.size_m2} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('apartments.table.price')}:</span>
                    <span className="text-sm font-bold text-green-600">€{apartment.price.toLocaleString('hr-HR')}</span>
                  </div>

                  {(aptLinkedGarages.length > 0 || aptLinkedStorages.length > 0) && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">{t('apartments.link_units')}:</p>
                      {aptLinkedGarages.map((garage) => (
                        <div key={garage.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span className="flex items-center">
                            <Warehouse className="w-3 h-3 mr-1 text-orange-600" />
                            {t('common.garage')} {garage.number}
                          </span>
                          <span className="font-medium text-orange-600">€{garage.price.toLocaleString('hr-HR')}</span>
                        </div>
                      ))}
                      {aptLinkedStorages.map((storage) => (
                        <div key={storage.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span className="flex items-center">
                            <Package className="w-3 h-3 mr-1 text-gray-600 dark:text-gray-400" />
                            {t('common.storage')} {storage.number}
                          </span>
                          <span className="font-medium text-gray-600 dark:text-gray-400">€{storage.price.toLocaleString('hr-HR')}</span>
                        </div>
                      ))}
                      <div className="flex justify-between mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('common.total')}:</span>
                        <span className="text-xs font-bold text-green-600">€{totalPrice.toLocaleString('hr-HR')}</span>
                      </div>
                    </div>
                  )}

                  {apartment.status === 'Sold' && apartment.buyer_name && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('apartments.table.buyer')}:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{apartment.buyer_name}</span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('apartments.payment_history_modal.progress')}</span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{overallPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
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
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
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
                    {t('apartments.payment_history')}
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
                      {t('apartments.link_units')}
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
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedApartment(apartment)
                        setShowDetailsModal(true)
                      }}
                    >
                      {t('apartments.details')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteApartment(apartment.id)}
                    >
                      {t('common.delete')}
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
              <span className="font-medium">{t('customers.sales_payments.filtered_results')}</span>
            </div>
            <div>
              Showing <span className="font-semibold">{filteredApartments.length}</span> of{' '}
              <span className="font-semibold">{apartments.length}</span> {t('apartments.title').toLowerCase()}
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

      <ConfirmDialog
        show={!!pendingDeleteApartmentId}
        title="Potvrda brisanja"
        message={(() => {
          const apt = apartments.find(a => a.id === pendingDeleteApartmentId)
          const label = apt ? `Unit ${apt.number} (${apt.project_name} - ${apt.building_name})` : 'this apartment'
          return `Are you sure you want to delete ${label}? This action cannot be undone.`
        })()}
        confirmLabel="Da, obriši"
        cancelLabel="Odustani"
        variant="danger"
        onConfirm={confirmDeleteApartment}
        onCancel={() => setPendingDeleteApartmentId(null)}
        loading={deletingApartment}
      />
    </div>
  )
}

export default ApartmentManagement
