import React from 'react'
import { useTranslation } from 'react-i18next'
import { Select, FormField } from '../../ui'
import { allowedPaymentMethods, type PaymentMethod } from '../services/paymentHelpers'

const METHOD_LABEL_KEYS: Record<PaymentMethod, string> = {
  WIRE: 'payments.method_wire',
  CASH: 'payments.method_cash',
  CHECK: 'payments.method_check',
  CARD: 'payments.method_card',
}

interface PaymentMethodFieldProps {
  value: string
  source: string
  isCesija: boolean
  onChange: (method: PaymentMethod) => void
}

/**
 * Payment method select shared by both payment forms. Offers only the methods allowed for the
 * source (see allowedPaymentMethods) and renders nothing for kompenzacija, which has no method.
 *
 * A stored method that is no longer allowed (an older row being edited) stays listed so the
 * select shows what is actually saved; validatePaymentForm then asks for a valid one.
 */
export const PaymentMethodField: React.FC<PaymentMethodFieldProps> = ({ value, source, isCesija, onChange }) => {
  const { t } = useTranslation()
  const allowed = allowedPaymentMethods(source, isCesija)

  if (allowed.length === 0) return null

  const options: PaymentMethod[] = value in METHOD_LABEL_KEYS && !(allowed as string[]).includes(value)
    ? [...allowed, value as PaymentMethod]
    : allowed

  return (
    <FormField label={t('payments.form.method_label')} required>
      <Select value={value} onChange={(e) => onChange(e.target.value as PaymentMethod)}>
        {options.map(method => (
          <option key={method} value={method}>{t(METHOD_LABEL_KEYS[method])}</option>
        ))}
      </Select>
    </FormField>
  )
}
