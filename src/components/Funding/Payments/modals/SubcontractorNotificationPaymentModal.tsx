import React, { useState, useEffect } from 'react'
import {
  PaymentNotification,
  fetchMilestoneProjectId,
  fetchProjectBanks,
  fetchSubcontractorPaymentTotal,
  fetchSubcontractorFinancingBank,
  recordSubcontractorMilestonePayment
} from '../services/paymentNotificationService'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../../ui'
import { useToast } from '../../../../contexts/ToastContext'

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
  const { t } = useTranslation()
  const toast = useToast()
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [banks, setBanks] = useState<Funder[]>([])
  const [paidByBankId, setPaidByBankId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [alreadyPaid, setAlreadyPaid] = useState(0)
  const [contractValue, setContractValue] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
    if (!notification?.subcontractor_id || !notification.milestone_id) return
    try {
      const projectId = await fetchMilestoneProjectId(notification.milestone_id)
      const uniqueBanks = await fetchProjectBanks(projectId)
      setBanks(uniqueBanks)
    } catch (error) {
      console.error('Error loading funders:', error)
    }
  }

  const loadPaymentHistory = async () => {
    if (!notification?.subcontractor_id) return
    try {
      const total = await fetchSubcontractorPaymentTotal(notification.subcontractor_id)
      setAlreadyPaid(total)
    } catch (error) {
      console.error('Error loading payment history:', error)
    }
  }

  const loadSubcontractorFinancing = async () => {
    if (!notification?.subcontractor_id) return
    try {
      const bankId = await fetchSubcontractorFinancingBank(notification.subcontractor_id)
      if (bankId) setPaidByBankId(bankId)
    } catch (error) {
      console.error('Error loading subcontractor financing:', error)
    }
  }

  const handleSubmit = async () => {
    if (!notification) return
    const errors: Record<string, string> = {}
    if (amount <= 0) errors.amount = t('funding.payments.subcontractor_modal.amount_error')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      await recordSubcontractorMilestonePayment({
        subcontractor_id: notification.subcontractor_id!,
        amount,
        payment_date: paymentDate || null,
        notes,
        milestone_id: notification.milestone_id!,
        paid_by_bank_id: paidByBankId
      })
      toast.success(t('funding.payments.subcontractor_modal.success_message'))
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error recording payment:', error)
      toast.error(t('funding.payments.subcontractor_modal.error_message'))
    } finally {
      setLoading(false)
    }
  }

  if (!notification || notification.payment_source !== 'subcontractor') return null

  const remaining = Math.max(0, contractValue - alreadyPaid)

  return (
    <Modal show={visible} onClose={onClose} size="sm">
      <Modal.Header
        title={t('funding.payments.subcontractor_modal.title')}
        subtitle={notification.subcontractor_name}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">{t('funding.payments.subcontractor_modal.contract_amount_label')}</span>
            <span className="text-sm font-medium text-gray-900">{contractValue.toLocaleString('hr-HR')}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">{t('funding.payments.subcontractor_modal.already_paid_label')}</span>
            <span className="text-sm font-medium text-teal-600">{alreadyPaid.toLocaleString('hr-HR')}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">{t('funding.payments.subcontractor_modal.remaining_label')}</span>
            <span className="text-sm font-bold text-orange-600">{remaining.toLocaleString('hr-HR')}</span>
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-blue-900">{t('funding.payments.subcontractor_modal.milestone_label')}</span>
            <span className="text-sm text-blue-700">{notification.milestone_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-blue-900">{t('funding.payments.subcontractor_modal.percentage_label')}</span>
            <span className="text-sm text-blue-700">{notification.milestone_percentage}%</span>
          </div>
        </div>

        <FormField label={t('funding.payments.subcontractor_modal.amount_label')} required error={fieldErrors.amount} helperText={t('funding.payments.subcontractor_modal.amount_helper')}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder={t('funding.payments.wire_payment_modal.amount_placeholder')}
            autoFocus
          />
        </FormField>

        <FormField label={t('funding.payments.subcontractor_modal.date_label')} helperText={t('funding.payments.subcontractor_modal.date_helper')}>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </FormField>

        {banks.length > 0 && (
          <FormField label={t('funding.payments.subcontractor_modal.paid_by_label')} helperText={t('funding.payments.subcontractor_modal.paid_by_helper')}>
            <Select
              value={paidByBankId || ''}
              onChange={(e) => setPaidByBankId(e.target.value || null)}
            >
              <option value="">{t('funding.payments.subcontractor_modal.no_payer')}</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label={t('funding.payments.subcontractor_modal.notes_label')}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t('funding.payments.subcontractor_modal.notes_placeholder')}
          />
        </FormField>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={loading}>{t('funding.payments.subcontractor_modal.cancel_button')}</Button>
        <Button variant="success" onClick={handleSubmit} loading={loading} disabled={amount <= 0}>
          {t('funding.payments.subcontractor_modal.submit_button')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
