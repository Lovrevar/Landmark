import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus } from 'lucide-react'
import { UnitType } from '../types'
import { Button, Modal, FormField, Input, Alert, Form } from '../../../ui'
import { calculateAdjustedPriceRange } from '../../utils/priceUtils'
import { formatEuro } from '../../../../utils/formatters'

interface BulkPriceUpdateModalProps {
  visible: boolean
  selectedUnits: { id: string; price: number; size_m2: number; price_per_m2?: number }[]
  unitType: UnitType
  onClose: () => void
  onSubmit: (adjustmentType: 'increase' | 'decrease', adjustmentValue: number) => Promise<void> | void
}

export const BulkPriceUpdateModal: React.FC<BulkPriceUpdateModalProps> = ({
  visible,
  selectedUnits,
  onClose,
  onSubmit
}) => {
  const { t } = useTranslation()
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase')
  const [adjustmentValue, setAdjustmentValue] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visible) {
      setAdjustmentType('increase')
      setAdjustmentValue('')
    }
  }, [visible])

  const priceRange = useMemo(() => selectedUnits.length > 0
    ? {
        min: Math.min(...selectedUnits.map(u => u.price_per_m2 || 0)),
        max: Math.max(...selectedUnits.map(u => u.price_per_m2 || 0))
      }
    : { min: 0, max: 0 }, [selectedUnits])

  const adjustment = parseFloat(adjustmentValue) || 0

  const newPriceRange = calculateAdjustedPriceRange(priceRange, adjustmentType, adjustment)

  const totalCurrentValue = useMemo(
    () => selectedUnits.reduce((sum, unit) => sum + (unit.price || 0), 0),
    [selectedUnits]
  )

  const totalNewValue = useMemo(() => selectedUnits.reduce((sum, unit) => {
    const newPricePerM2 = adjustmentType === 'increase'
      ? (unit.price_per_m2 || 0) + adjustment
      : (unit.price_per_m2 || 0) - adjustment
    return sum + (unit.size_m2 * Math.max(0, newPricePerM2))
  }, 0), [selectedUnits, adjustmentType, adjustment])

  const totalValueChange = totalNewValue - totalCurrentValue

  const wouldCreateNegativePrice = adjustmentType === 'decrease' &&
    selectedUnits.some(unit => (unit.price_per_m2 || 0) - adjustment < 0)

  if (!visible) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const errors: Record<string, string> = {}
    if (!adjustmentValue || parseFloat(adjustmentValue) <= 0) {
      errors.adjustmentValue = t('sales_projects.bulk_price.error_amount_required')
    }
    if (wouldCreateNegativePrice) {
      errors.adjustmentValue = t('sales_projects.bulk_price.error_negative')
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    return onSubmit(adjustmentType, adjustment)
  }


  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={t('sales_projects.bulk_price.title')}
        subtitle={`${t('sales_projects.bulk_price.selected')}: ${selectedUnits.length} ${t('sales_projects.bulk_price.units')}`}
        onClose={onClose}
      />
      <Modal.Body>
        <Form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{t('sales_projects.bulk_price.selection_summary')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700 dark:text-blue-300">{t('sales_projects.bulk_price.selected_units')}:</p>
                <p className="font-bold text-blue-900 dark:text-blue-100">{selectedUnits.length}</p>
              </div>
              <div>
                <p className="text-blue-700 dark:text-blue-300">{t('sales_projects.bulk_price.current_price_range')}:</p>
                <p className="font-bold text-blue-900 dark:text-blue-100">
                  {formatEuro(priceRange.min)}
                  {priceRange.min !== priceRange.max && (
                    <> - {formatEuro(priceRange.max)}</>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {t('sales_projects.bulk_price.adjustment_type')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAdjustmentType('increase')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                  adjustmentType === 'increase'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <Plus className="w-5 h-5 mr-2" />
                <span className="font-semibold">{t('sales_projects.bulk_price.increase_price')}</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('decrease')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                  adjustmentType === 'decrease'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <Minus className="w-5 h-5 mr-2" />
                <span className="font-semibold">{t('sales_projects.bulk_price.decrease_price')}</span>
              </button>
            </div>
          </div>

          <FormField label={t('sales_projects.bulk_price.adjustment_amount')} error={fieldErrors.adjustmentValue}>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
              placeholder={t('sales_projects.bulk_price.amount_placeholder')}
            />
          </FormField>

          {adjustmentValue && parseFloat(adjustmentValue) > 0 && (
            <div className={`border-2 rounded-lg p-4 ${
              adjustmentType === 'increase' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20'
            }`}>
              <h3 className={`font-semibold mb-3 ${
                adjustmentType === 'increase' ? 'text-green-900 dark:text-green-400' : 'text-red-900 dark:text-red-400'
              }`}>
                {t('sales_projects.bulk_price.price_preview')}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {t(
                      adjustmentType === 'increase'
                        ? 'sales_projects.bulk_price.preview_add'
                        : 'sales_projects.bulk_price.preview_subtract',
                      { amount: `${adjustmentType === 'increase' ? '+' : '-'}${formatEuro(adjustment)}` }
                    )}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-200">{t('sales_projects.bulk_price.new_price_range')}:</span>
                    <span className={`font-bold text-lg ${
                      adjustmentType === 'increase' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {formatEuro(newPriceRange.min)}
                      {newPriceRange.min !== newPriceRange.max && (
                        <> - {formatEuro(newPriceRange.max)}</>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-300 dark:border-gray-600">
                  <span className="text-gray-700 dark:text-gray-200">{t('sales_projects.bulk_price.current_total_value')}:</span>
                  <span className="font-semibold">€{totalCurrentValue.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-200">{t('sales_projects.bulk_price.new_total_value')}:</span>
                  <span className="font-semibold">€{totalNewValue.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-400 dark:border-gray-600">
                  <span className="font-bold text-gray-900 dark:text-white">{t('sales_projects.bulk_price.total_value_change')}:</span>
                  <span className={`font-bold text-lg ${
                    totalValueChange >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {totalValueChange >= 0 ? '+' : ''}€{totalValueChange.toLocaleString('hr-HR')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {wouldCreateNegativePrice && (
            <Alert variant="warning">
              {t('sales_projects.bulk_price.negative_warning')}
            </Alert>
          )}

          <Alert variant="warning">
            {t('sales_projects.bulk_price.update_warning', { count: selectedUnits.length })}
          </Alert>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="success"
          onClick={handleSubmit}
          disabled={wouldCreateNegativePrice}
        >
          {t('sales_projects.bulk_price.update_units', { count: selectedUnits.length })}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
