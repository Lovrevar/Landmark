import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Subcontractor, SubcontractorMilestone } from '../../../../lib/supabase'
import { fetchMilestonesBySubcontractor, fetchProjectFunders } from '../services/siteService'
import { Modal, FormField, Input, Select, Textarea, Button, Alert } from '../../../ui'

interface Funder {
  id: string
  name: string
}

interface WirePaymentModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: Subcontractor | null
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onNotesChange: (notes: string) => void
  onSubmit: (milestoneId?: string, paidByBankId?: string | null) => void
  projectId: string
}

export const WirePaymentModal: React.FC<WirePaymentModalProps> = ({
  visible,
  onClose,
  subcontractor,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit,
  projectId
}) => {
  const { t } = useTranslation()
  const [milestones, setMilestones] = useState<SubcontractorMilestone[]>([])
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('')
  const [, setLoading] = useState(false)
  const [banks, setBanks] = useState<Funder[]>([])
  const [loadingFunders, setLoadingFunders] = useState(false)
  const [paidByBankId, setPaidByBankId] = useState<string | null>(null)

  useEffect(() => {
    if (visible && subcontractor) {
      loadMilestones()
      loadFunders()
      setPaidByBankId(subcontractor.financed_by_bank_id || null)
    } else {
      setMilestones([])
      setSelectedMilestoneId('')
      setPaidByBankId(null)
    }
  }, [visible, subcontractor])

  const loadMilestones = async () => {
    if (!subcontractor) return
    try {
      setLoading(true)
      const data = await fetchMilestonesBySubcontractor(subcontractor.id)
      setMilestones(data.filter(m => m.status === 'pending'))
    } catch (error) {
      console.error('Error loading milestones:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFunders = async () => {
    if (!projectId) return
    try {
      setLoadingFunders(true)
      const funders = await fetchProjectFunders(projectId)
      setBanks(funders.banks)
    } catch (error) {
      console.error('Error loading funders:', error)
    } finally {
      setLoadingFunders(false)
    }
  }

  const handleMilestoneSelect = (milestoneId: string) => {
    setSelectedMilestoneId(milestoneId)
    if (milestoneId) {
      const milestone = milestones.find(m => m.id === milestoneId)
      if (milestone && subcontractor) {
        onAmountChange(((subcontractor.cost ?? 0) * milestone.percentage) / 100)
      }
    } else {
      onAmountChange(0)
    }
  }

  if (!visible || !subcontractor) return null

  const newTotalPaid = (subcontractor.budget_realized ?? 0) + amount
  const wouldBeOverBudget = newTotalPaid > (subcontractor.cost ?? 0)

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={t('supervision.payment_modal.title')}
        subtitle={subcontractor.name}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">{t('supervision.payment_modal.contract_amount')}</span>
            <span className="text-sm font-medium text-gray-900">€{(subcontractor.cost ?? 0).toLocaleString('hr-HR')}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">{t('supervision.payment_modal.already_paid')}</span>
            <span className="text-sm font-medium text-teal-600">€{(subcontractor.budget_realized ?? 0).toLocaleString('hr-HR')}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">{t('supervision.payment_modal.remaining')}</span>
            <span className="text-sm font-bold text-orange-600">
              €{Math.max(0, (subcontractor.cost ?? 0) - (subcontractor.budget_realized ?? 0)).toLocaleString('hr-HR')}
            </span>
          </div>
        </div>

        {milestones.length > 0 && (
          <FormField
            label={t('supervision.payment_modal.select_milestone')}
            helperText={t('supervision.payment_modal.milestone_help')}
          >
            <Select
              value={selectedMilestoneId}
              onChange={(e) => handleMilestoneSelect(e.target.value)}
            >
              <option value="">{t('supervision.payment_modal.manual_payment')}</option>
              {milestones.map((milestone) => {
                const milestoneAmount = ((subcontractor.cost ?? 0) * milestone.percentage) / 100
                return (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.milestone_number}. {milestone.milestone_name} - {milestone.percentage}% (€{milestoneAmount.toLocaleString('hr-HR')})
                  </option>
                )
              })}
            </Select>
          </FormField>
        )}

        <FormField
          label={t('supervision.payment_modal.payment_amount')}
          required
          helperText={t('supervision.payment_modal.payment_amount_help')}
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            placeholder={t('supervision.payment_modal.payment_amount')}
            autoFocus
          />
        </FormField>

        <FormField
          label={t('supervision.payment_modal.payment_date')}
          helperText={t('supervision.payment_modal.payment_date_help')}
        >
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </FormField>

        {banks.length > 0 && (
          <FormField
            label={t('supervision.payment_modal.paid_by')}
            helperText={
              subcontractor.financed_by_bank_id ? (
                <span className="text-blue-600">
                  {t('supervision.payment_modal.default')} {banks.find(b => b.id === subcontractor.financed_by_bank_id)?.name || t('common.bank')} {t('supervision.payment_modal.can_be_changed')}
                </span>
              ) : (
                t('supervision.payment_modal.paid_by_help')
              )
            }
          >
            <Select
              value={paidByBankId || ''}
              onChange={(e) => setPaidByBankId(e.target.value || null)}
              disabled={loadingFunders}
            >
              <option value="">{t('supervision.payment_modal.no_payer')}</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label={t('supervision.payment_modal.notes')}>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            placeholder={t('supervision.payment_modal.notes_placeholder')}
          />
        </FormField>

        {amount > 0 && wouldBeOverBudget && (
          <Alert variant="warning">
            <p className="text-sm">
              <span className="font-medium">{t('supervision.payment_modal.new_total')}</span> €{newTotalPaid.toLocaleString('hr-HR')}
            </p>
            <p className="text-sm mt-1">
              <span className="font-medium">{t('supervision.payment_modal.loss')}</span> €{(newTotalPaid - (subcontractor.cost ?? 0)).toLocaleString('hr-HR')}
            </p>
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="success" onClick={() => onSubmit(selectedMilestoneId || undefined, paidByBankId)} disabled={amount <= 0}>
          {t('supervision.payment_modal.record')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
