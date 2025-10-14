import React, { useState, useEffect } from 'react'
import { supabase, ApartmentPayment } from '../lib/supabase'
import { Home, DollarSign, User, Calendar, AlertCircle, Edit, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'

interface ApartmentWithPayments {
  id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: string
  buyer_name: string | null
  project_name: string
  building_name: string
  sale_price: number
  down_payment: number
  total_paid: number
  remaining_amount: number
  payment_method: string
  contract_signed: boolean
  sale_date: string | null
}

const ApartmentManagement: React.FC = () => {
  const [apartments, setApartments] = useState<ApartmentWithPayments[]>([])
  const [selectedApartment, setSelectedApartment] = useState<ApartmentWithPayments | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWireModal, setShowWireModal] = useState(false)
  const [showPaymentsModal, setShowPaymentsModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [payments, setPayments] = useState<ApartmentPayment[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          apartments!inner(
            id,
            number,
            floor,
            size_m2,
            price,
            status,
            buyer_name,
            project_id,
            building_id
          )
        `)
        .eq('apartments.status', 'Sold')

      if (salesError) throw salesError

      const projectIds = [...new Set(salesData?.map((s: any) => s.apartments.project_id) || [])]
      const buildingIds = [...new Set(salesData?.map((s: any) => s.apartments.building_id) || [])]

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds)

      const { data: buildingsData } = await supabase
        .from('buildings')
        .select('id, name')
        .in('id', buildingIds)

      const apartmentsWithDetails: ApartmentWithPayments[] = (salesData || []).map((sale: any) => {
        const project = projectsData?.find(p => p.id === sale.apartments.project_id)
        const building = buildingsData?.find(b => b.id === sale.apartments.building_id)

        return {
          id: sale.apartments.id,
          number: sale.apartments.number,
          floor: sale.apartments.floor,
          size_m2: sale.apartments.size_m2,
          price: sale.apartments.price,
          status: sale.apartments.status,
          buyer_name: sale.apartments.buyer_name,
          project_name: project?.name || 'Unknown Project',
          building_name: building?.name || 'Unknown Building',
          sale_price: sale.sale_price,
          down_payment: sale.down_payment,
          total_paid: sale.total_paid,
          remaining_amount: sale.remaining_amount,
          payment_method: sale.payment_method,
          contract_signed: sale.contract_signed,
          sale_date: sale.sale_date
        }
      })

      setApartments(apartmentsWithDetails)
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPayments = async (apartmentId: string) => {
    const { data, error } = await supabase
      .from('apartment_payments')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching payments:', error)
      return []
    }

    return data || []
  }

  const handleWirePayment = (apartment: ApartmentWithPayments) => {
    setSelectedApartment(apartment)
    setPaymentAmount(0)
    setPaymentDate('')
    setPaymentNotes('')
    setShowWireModal(true)
  }

  const handleShowPayments = async (apartment: ApartmentWithPayments) => {
    setSelectedApartment(apartment)
    const paymentsData = await fetchPayments(apartment.id)
    setPayments(paymentsData)
    setShowPaymentsModal(true)
  }

  const handleShowDetails = (apartment: ApartmentWithPayments) => {
    setSelectedApartment(apartment)
    setShowDetailsModal(true)
  }

  const handleEdit = (apartment: ApartmentWithPayments) => {
    setSelectedApartment(apartment)
    setShowEditModal(true)
  }

  const handleDelete = async (apartmentId: string, apartmentNumber: string) => {
    if (!confirm(`Are you sure you want to delete apartment ${apartmentNumber}? This will also delete all payment records.`)) {
      return
    }

    const { error } = await supabase
      .from('apartments')
      .delete()
      .eq('id', apartmentId)

    if (error) {
      console.error('Error deleting apartment:', error)
      alert('Failed to delete apartment')
    } else {
      fetchData()
    }
  }

  const handleSubmitPayment = async () => {
    if (!selectedApartment || paymentAmount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    const { error: paymentError } = await supabase
      .from('apartment_payments')
      .insert({
        apartment_id: selectedApartment.id,
        amount: paymentAmount,
        payment_date: paymentDate || null,
        notes: paymentNotes || null
      })

    if (paymentError) {
      console.error('Error creating payment:', paymentError)
      alert('Failed to record payment')
      return
    }

    const newTotalPaid = selectedApartment.total_paid + paymentAmount
    const newRemainingAmount = selectedApartment.sale_price - newTotalPaid

    const { error: saleError } = await supabase
      .from('sales')
      .update({
        total_paid: newTotalPaid,
        remaining_amount: newRemainingAmount
      })
      .eq('apartment_id', selectedApartment.id)

    if (saleError) {
      console.error('Error updating sale:', saleError)
    }

    setShowWireModal(false)
    fetchData()
  }

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    if (!selectedApartment || !confirm('Are you sure you want to delete this payment?')) {
      return
    }

    const { error: deleteError } = await supabase
      .from('apartment_payments')
      .delete()
      .eq('id', paymentId)

    if (deleteError) {
      console.error('Error deleting payment:', deleteError)
      alert('Failed to delete payment')
      return
    }

    const newTotalPaid = selectedApartment.total_paid - amount
    const newRemainingAmount = selectedApartment.sale_price - newTotalPaid

    const { error: updateError } = await supabase
      .from('sales')
      .update({
        total_paid: newTotalPaid,
        remaining_amount: newRemainingAmount
      })
      .eq('apartment_id', selectedApartment.id)

    if (updateError) {
      console.error('Error updating sale:', updateError)
    }

    const updatedPayments = await fetchPayments(selectedApartment.id)
    setPayments(updatedPayments)
    fetchData()
  }

  if (loading) {
    return <div className="text-center py-12">Loading apartments...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Apartments</h1>
          <p className="text-gray-600 mt-2">Overview of all sold apartments and their payments</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Apartments</p>
          <p className="text-2xl font-bold text-gray-900">{apartments.length}</p>
        </div>
      </div>

      {apartments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Sold Apartments Yet</h3>
          <p className="text-gray-600">Sold apartments will appear here for payment tracking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {apartments.map((apartment) => {
            const paymentPercentage = apartment.sale_price > 0
              ? (apartment.total_paid / apartment.sale_price) * 100
              : 0

            const paymentStatus = apartment.total_paid > apartment.sale_price ? 'Over Budget' :
                                 apartment.total_paid === apartment.sale_price ? 'Fully Paid' :
                                 apartment.total_paid > 0 ? 'Partial Payment' : 'Unpaid'

            return (
              <div
                key={apartment.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Unit {apartment.number}</h3>
                    <p className="text-sm text-gray-600">Floor {apartment.floor}</p>
                    <p className="text-sm text-gray-600">{apartment.building_name}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Home className="w-5 h-5 text-blue-600" />
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Project:</span>
                    <span className="font-medium text-gray-900">{apartment.project_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Size:</span>
                    <span className="font-medium text-gray-900">{apartment.size_m2} m²</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Buyer:</span>
                    <span className="font-medium text-gray-900">{apartment.buyer_name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Sale Price:</span>
                    <span className="font-bold text-gray-900">€{apartment.sale_price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-medium text-teal-600">€{apartment.total_paid.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-medium text-orange-600">€{apartment.remaining_amount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-600">Payment Progress</span>
                    <span className="text-xs font-medium text-gray-900">{paymentPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, paymentPercentage)}%` }}
                    />
                  </div>
                  <div className="mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      apartment.total_paid > apartment.sale_price ? 'bg-red-100 text-red-800' :
                      apartment.total_paid === apartment.sale_price ? 'bg-green-100 text-green-800' :
                      apartment.total_paid > 0 ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => handleWirePayment(apartment)}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm font-medium"
                  >
                    Wire
                  </button>
                  <button
                    onClick={() => handleShowPayments(apartment)}
                    className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 text-sm font-medium"
                  >
                    Payments
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEdit(apartment)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleShowDetails(apartment)}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => handleDelete(apartment.id, apartment.number)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showWireModal && selectedApartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Wire Payment</h3>
                  <p className="text-sm text-gray-600 mt-1">Unit {selectedApartment.number}</p>
                </div>
                <button
                  onClick={() => setShowWireModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Sale Price:</span>
                  <span className="text-sm font-medium text-gray-900">€{selectedApartment.sale_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Already Paid:</span>
                  <span className="text-sm font-medium text-teal-600">€{selectedApartment.total_paid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Remaining:</span>
                  <span className="text-sm font-bold text-orange-600">
                    €{Math.max(0, selectedApartment.remaining_amount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount (€) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter payment amount"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Date (Optional)
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Add any notes about this payment"
                />
              </div>

              {paymentAmount > 0 && (
                <div className={`p-3 rounded-lg mb-4 ${
                  selectedApartment.total_paid + paymentAmount > selectedApartment.sale_price
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <p className={`text-sm ${
                    selectedApartment.total_paid + paymentAmount > selectedApartment.sale_price
                      ? 'text-red-700'
                      : 'text-blue-700'
                  }`}>
                    <span className="font-medium">New Total Paid:</span> €{(selectedApartment.total_paid + paymentAmount).toLocaleString()}
                  </p>
                  {selectedApartment.total_paid + paymentAmount > selectedApartment.sale_price && (
                    <p className="text-sm text-red-700 mt-1">
                      <span className="font-medium">Excess:</span> €{(selectedApartment.total_paid + paymentAmount - selectedApartment.sale_price).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowWireModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPayment}
                  disabled={paymentAmount <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentsModal && selectedApartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Payment History</h3>
                  <p className="text-sm text-gray-600 mt-1">Unit {selectedApartment.number}</p>
                </div>
                <button
                  onClick={() => setShowPaymentsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Sale Price</p>
                    <p className="text-lg font-bold text-gray-900">€{selectedApartment.sale_price.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Paid</p>
                    <p className="text-lg font-bold text-teal-600">€{selectedApartment.total_paid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Remaining</p>
                    <p className="text-lg font-bold text-orange-600">
                      €{Math.max(0, selectedApartment.remaining_amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 mb-3">All Payments ({payments.length})</h4>

              {payments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No payments recorded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-lg font-bold text-gray-900">€{payment.amount.toLocaleString()}</span>
                            {payment.payment_date && (
                              <span className="text-sm text-gray-600">
                                {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                              </span>
                            )}
                            {!payment.payment_date && (
                              <span className="text-sm text-gray-400 italic">Date not set</span>
                            )}
                          </div>
                          {payment.notes && (
                            <p className="text-sm text-gray-600 mb-2">{payment.notes}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            Created {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleDeletePayment(payment.id, payment.amount)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedApartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Unit {selectedApartment.number}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedApartment.building_name}</p>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedApartment.total_paid > selectedApartment.sale_price ? 'bg-red-100 text-red-800' :
                      selectedApartment.total_paid === selectedApartment.sale_price ? 'bg-green-100 text-green-800' :
                      selectedApartment.total_paid > 0 ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedApartment.total_paid > selectedApartment.sale_price ? 'Overpaid' :
                       selectedApartment.total_paid === selectedApartment.sale_price ? 'Fully Paid' :
                       selectedApartment.total_paid > 0 ? 'Partial Payment' : 'Unpaid'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4">
                <p className="text-gray-700">Project: {selectedApartment.project_name}</p>
                <p className="text-gray-700 mt-1">Buyer: {selectedApartment.buyer_name || 'N/A'}</p>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Sale Price</p>
                    <p className="text-lg font-bold text-gray-900">€{selectedApartment.sale_price.toLocaleString()}</p>
                  </div>
                  <div className="bg-teal-50 p-3 rounded-lg">
                    <p className="text-xs text-teal-700 mb-1">Paid Amount</p>
                    <p className="text-lg font-bold text-teal-900">€{selectedApartment.total_paid.toLocaleString()}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    selectedApartment.total_paid > selectedApartment.sale_price ? 'bg-red-50' :
                    selectedApartment.total_paid < selectedApartment.sale_price ? 'bg-green-50' :
                    'bg-gray-50'
                  }`}>
                    <p className={`text-xs mb-1 ${
                      selectedApartment.total_paid > selectedApartment.sale_price ? 'text-red-700' :
                      selectedApartment.total_paid < selectedApartment.sale_price ? 'text-green-700' :
                      'text-gray-600'
                    }`}>Gain/Loss</p>
                    <p className={`text-lg font-bold ${
                      selectedApartment.total_paid > selectedApartment.sale_price ? 'text-red-900' :
                      selectedApartment.total_paid < selectedApartment.sale_price ? 'text-green-900' :
                      'text-gray-900'
                    }`}>
                      {selectedApartment.total_paid > selectedApartment.sale_price ? '-' :
                       selectedApartment.total_paid < selectedApartment.sale_price ? '+' : ''}
                      €{Math.abs(selectedApartment.total_paid - selectedApartment.sale_price).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <h4 className="font-medium text-gray-900 mb-4">Apartment Details</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Floor:</span>
                  <span className="font-medium text-gray-900">{selectedApartment.floor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Size:</span>
                  <span className="font-medium text-gray-900">{selectedApartment.size_m2} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium text-gray-900">{selectedApartment.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contract Signed:</span>
                  <span className="font-medium text-gray-900">{selectedApartment.contract_signed ? 'Yes' : 'No'}</span>
                </div>
                {selectedApartment.sale_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sale Date:</span>
                    <span className="font-medium text-gray-900">
                      {format(new Date(selectedApartment.sale_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApartmentManagement
