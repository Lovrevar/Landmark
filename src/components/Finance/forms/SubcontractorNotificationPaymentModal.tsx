import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { PaymentNotification } from '../services/paymentNotificationService'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../ui'

interface Funder {
  id: string
  name: string
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
  const [banks, setBanks] = useState<Funder[]>([])
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
      const { data: milestoneData, error: milestoneError } = await supabase
        .from('subcontractor_milestones')
        .select('project_id')
        .eq('id', notification.milestone_id!)
        .single()

      if (milestoneError) throw milestoneError

      const { data: allocationsData, error: allocationsError } = await supabase
        .from('credit_allocations')
        .select('bank_credits(banks(id, name))')
        .eq('project_id', milestoneData.project_id)

      if (allocationsError) throw allocationsError

      const uniqueBanks = Array.from(
        new Map(
          (allocationsData || [])
            .filter((alloc: any) => alloc.bank_credits?.banks)
            .map((alloc: any) => [alloc.bank_credits.banks.id, { id: alloc.bank_credits.banks.id, name: alloc.bank_credits.banks.name }])
        ).values()
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
        .from('subcontractor_payments')
        .select('amount')
        .eq('subcontractor_id', notification.subcontractor_id)

      if (error) throw error

      setAlreadyPaid((data || []).reduce((sum, payment) => sum + Number(payment.amount), 0))
    } catch (error) {
      console.error('Error loading payment history:', error)
    }
  }

  const loadSubcontractorFinancing = async () => {
    if (!notification?.subcontractor_id) return

    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('financed_by_bank_id')
        .eq('id', notification.subcontractor_id)
        .single()

      if (error) throw error

      if (data.financed_by_bank_id) {
        setPaidByBankId(data.financed_by_bank_id)
      }
    } catch (error) {
      console.error('Error loading subcontractor financing:', error)
    }
  }

  const handleSubmit = async () => {
    if (!notification || amount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    setLoading(true)
    try {
      const { error: paymentError } = await supabase
        .from('subcontractor_payments')
        .insert({
          subcontractor_id: notification.subcontractor_id,
          amount,
          payment_date: paymentDate || null,
          notes,
          milestone_id: notification.milestone_id,
          paid_by_type: paidByBankId ? 'bank' : null,
          paid_by_bank_id: paidByBankId
        })

      if (paymentError) throw paymentError

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

  if (!notification || notification.payment_source !== 'subcontractor') return null

  const remaining = Math.max(0, contractValue - alreadyPaid)

  return (
    <Modal show={visible} onClose={onClose} size="sm">
      <Modal.Header
        title="Wire Payment"
        subtitle={notification.subcontractor_name}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Contract Amount:</span>
            <span className="text-sm font-medium text-gray-900">{contractValue.toLocaleString('hr-HR')}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Already Paid:</span>
            <span className="text-sm font-medium text-teal-600">{alreadyPaid.toLocaleString('hr-HR')}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">Remaining:</span>
            <span className="text-sm font-bold text-orange-600">{remaining.toLocaleString('hr-HR')}</span>
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-blue-900">Milestone:</span>
            <span className="text-sm text-blue-700">{notification.milestone_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-blue-900">Percentage:</span>
            <span className="text-sm text-blue-700">{notification.milestone_percentage}%</span>
          </div>
        </div>

        <FormField label="Payment Amount" required helperText="You can pay any amount, including more than the contract value">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="Enter payment amount"
            autoFocus
          />
        </FormField>

        <FormField label="Payment Date (Optional)" helperText="Leave empty if date is not yet known">
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </FormField>

        {banks.length > 0 && (
          <FormField label="Paid By (Optional)" helperText="Select which bank is making this payment">
            <Select
              value={paidByBankId || ''}
              onChange={(e) => setPaidByBankId(e.target.value || null)}
            >
              <option value="">No payer selected</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label="Notes (Optional)">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any notes about this payment"
          />
        </FormField>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="success" onClick={handleSubmit} loading={loading} disabled={amount <= 0}>
          Record Payment
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
