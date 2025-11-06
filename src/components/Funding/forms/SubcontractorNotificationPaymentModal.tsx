import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { PaymentNotification } from '../services/paymentNotificationService'

interface Funder {
  id: string
  name: string
  type?: string
}

interface SubcontractorNotificationPaymentModalProps {
  visible: boolean
  onClose: () => void
  notification: PaymentNotification | null
  onSuccess: () => void
}

export const SubcontractorNotificationPaymentModal: React.FC<SubcontractorNotificationPaymentModalProps> = ({
  visible,
  onClose,
  notification,
  onSuccess
}) => {
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [investors, setInvestors] = useState<Funder[]>([])
  const [banks, setBanks] = useState<Funder[]>([])
  const [paidByType, setPaidByType] = useState<'investor' | 'bank' | null>(null)
  const [paidByInvestorId, setPaidByInvestorId] = useState<string | null>(null)
  const [paidByBankId, setPaidByBankId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [alreadyPaid, setAlreadyPaid] = useState(0)
  const [contractValue, setContractValue] = useState(0)

  useEffect(() => {
    if (visible && notification && notification.payment_source === 'subcontractor') {
      setAmount(notification.amount)
      setContractValue(notification.contract_value || 0)
      setNotes(`Payment for ${notification.subcontractor_name} - ${notification.milestone_name} (${notification.milestone_percentage}%)`)
      loadFunders()
      loadPaymentHistory()
      loadSubcontractorFinancing()
    }
  }, [visible, notification])

  const loadFunders = async () => {
    if (!notification?.subcontractor_id) return

    try {
      // Fetch milestone details to get project_id
      const { data: milestoneData, error: milestoneError } = await supabase
        .from('subcontractor_milestones')
        .select('project_id')
        .eq('id', notification.milestone_id!)
        .single()

      if (milestoneError) throw milestoneError

      const projectId = milestoneData.project_id

      // Fetch investors for this project
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select('investors(id, name)')
        .eq('project_id', projectId)

      if (investmentsError) throw investmentsError

      const uniqueInvestors = investmentsData
        .filter(inv => inv.investors)
        .map(inv => ({ id: inv.investors!.id, name: inv.investors!.name }))
        .filter((investor, index, self) =>
          index === self.findIndex(i => i.id === investor.id)
        )

      setInvestors(uniqueInvestors)

      // Fetch banks for this project
      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select('banks(id, name)')
        .eq('project_id', projectId)

      if (creditsError) throw creditsError

      const uniqueBanks = creditsData
        .filter(credit => credit.banks)
        .map(credit => ({ id: credit.banks!.id, name: credit.banks!.name }))
        .filter((bank, index, self) =>
          index === self.findIndex(b => b.id === bank.id)
        )

      setBanks(uniqueBanks)
    } catch (error) {
      console.error('Error loading funders:', error)
    }
  }

  const loadPaymentHistory = async () => {
    if (!notification?.subcontractor_id) return

    try {
      const { data, error } = await supabase
        .from('wire_payments')
        .select('amount')
        .eq('subcontractor_id', notification.subcontractor_id)

      if (error) throw error

      const totalPaid = (data || []).reduce((sum, payment) => sum + Number(payment.amount), 0)
      setAlreadyPaid(totalPaid)
    } catch (error) {
      console.error('Error loading payment history:', error)
    }
  }

  const loadSubcontractorFinancing = async () => {
    if (!notification?.subcontractor_id) return

    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('financed_by_type, financed_by_investor_id, financed_by_bank_id')
        .eq('id', notification.subcontractor_id)
        .single()

      if (error) throw error

      if (data.financed_by_type && (data.financed_by_investor_id || data.financed_by_bank_id)) {
        setPaidByType(data.financed_by_type)
        if (data.financed_by_type === 'investor') {
          setPaidByInvestorId(data.financed_by_investor_id)
        } else {
          setPaidByBankId(data.financed_by_bank_id)
        }
      }
    } catch (error) {
      console.error('Error loading subcontractor financing:', error)
    }
  }

  const handlePaidByChange = (value: string) => {
    if (!value) {
      setPaidByType(null)
      setPaidByInvestorId(null)
      setPaidByBankId(null)
      return
    }

    const [type, id] = value.split(':')
    if (type === 'investor') {
      setPaidByType('investor')
      setPaidByInvestorId(id)
      setPaidByBankId(null)
    } else if (type === 'bank') {
      setPaidByType('bank')
      setPaidByBankId(id)
      setPaidByInvestorId(null)
    }
  }

  const getPaidByValue = () => {
    if (paidByType === 'investor' && paidByInvestorId) {
      return `investor:${paidByInvestorId}`
    }
    if (paidByType === 'bank' && paidByBankId) {
      return `bank:${paidByBankId}`
    }
    return ''
  }

  const handleSubmit = async () => {
    if (!notification || amount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      // Insert wire payment
      const { error: paymentError } = await supabase
        .from('wire_payments')
        .insert({
          subcontractor_id: notification.subcontractor_id,
          amount,
          payment_date: paymentDate || null,
          notes,
          milestone_id: notification.milestone_id,
          paid_by_investor_id: paidByInvestorId,
          paid_by_bank_id: paidByBankId,
          created_by: userId
        })

      if (paymentError) throw paymentError

      // Update milestone status to paid
      const { error: milestoneError } = await supabase
        .from('subcontractor_milestones')
        .update({
          status: 'paid',
          paid_date: paymentDate || new Date().toISOString().split('T')[0]
        })
        .eq('id', notification.milestone_id!)

      if (milestoneError) throw milestoneError

      alert('Payment recorded successfully')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  if (!visible || !notification || notification.payment_source !== 'subcontractor') return null

  const remaining = Math.max(0, contractValue - alreadyPaid)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full my-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Wire Payment</h3>
              <p className="text-sm text-gray-600 mt-1">{notification.subcontractor_name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Contract Amount:</span>
              <span className="text-sm font-medium text-gray-900">€{contractValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Already Paid:</span>
              <span className="text-sm font-medium text-teal-600">€{alreadyPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Remaining:</span>
              <span className="text-sm font-bold text-orange-600">
                €{remaining.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-blue-900">Milestone:</span>
              <span className="text-sm text-blue-700">{notification.milestone_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-blue-900">Percentage:</span>
              <span className="text-sm text-blue-700">{notification.milestone_percentage}%</span>
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
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter payment amount"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              You can pay any amount, including more than the contract value
            </p>
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
            <p className="text-xs text-gray-500 mt-1">
              Leave empty if date is not yet known
            </p>
          </div>

          {(investors.length > 0 || banks.length > 0) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paid By (Optional)
              </label>
              <select
                value={getPaidByValue()}
                onChange={(e) => handlePaidByChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">No payer selected</option>
                {investors.length > 0 && (
                  <optgroup label="Investors">
                    {investors.map(investor => (
                      <option key={investor.id} value={`investor:${investor.id}`}>
                        {investor.name} {investor.type && `(${investor.type})`}
                      </option>
                    ))}
                  </optgroup>
                )}
                {banks.length > 0 && (
                  <optgroup label="Banks">
                    {banks.map(bank => (
                      <option key={bank.id} value={`bank:${bank.id}`}>
                        {bank.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select which investor or bank is making this payment
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              placeholder="Add any notes about this payment"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:opacity-50"
            disabled={loading || amount <= 0}
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
