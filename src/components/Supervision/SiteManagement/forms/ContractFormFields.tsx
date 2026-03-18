import React from 'react'
import { SubcontractorFormData, VAT_RATE_OPTIONS } from '../types'
import { FormField, Input, Select } from '../../../ui'
import { formatEuro } from '../../../../utils/formatters'

interface Props {
  formData: Pick<SubcontractorFormData, 'base_amount' | 'vat_rate' | 'start_date' | 'deadline'>
  vatAmount: number
  totalAmount: number
  onChange: (updates: Partial<SubcontractorFormData>) => void
  deadlineRequired?: boolean
}

export const ContractFormFields: React.FC<Props> = ({
  formData,
  vatAmount,
  totalAmount,
  onChange,
  deadlineRequired = false
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Osnovica (€)" helperText="Base amount without VAT" required>
          <Input
            type="number"
            value={formData.base_amount}
            onChange={(e) => onChange({ base_amount: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            step="0.01"
          />
        </FormField>
        <FormField label="PDV stopa" required>
          <Select
            value={formData.vat_rate}
            onChange={(e) => onChange({ vat_rate: parseFloat(e.target.value) })}
          >
            {VAT_RATE_OPTIONS.map(r => (
              <option key={r} value={r}>{r}%</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
        <div>
          <label className="text-xs text-gray-600">Iznos PDV</label>
          <p className="text-lg font-semibold text-gray-900">{formatEuro(vatAmount)}</p>
        </div>
        <div>
          <label className="text-xs text-gray-600">Ukupno</label>
          <p className="text-lg font-bold text-blue-600">{formatEuro(totalAmount)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Datum Ugovora">
          <Input
            type="date"
            value={formData.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
          />
        </FormField>
        <FormField label="Deadline" required={deadlineRequired}>
          <Input
            type="date"
            value={formData.deadline}
            onChange={(e) => onChange({ deadline: e.target.value })}
          />
        </FormField>
      </div>
    </div>
  )
}
