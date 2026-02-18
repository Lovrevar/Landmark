import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { FormField, Input, Select } from '../../ui'

export interface ContractFields {
  datum_potpisa_predugovora: string
  contract_payment_type: 'credit' | 'installments' | ''
  kapara_10_posto: string
  rata_1_ab_konstrukcija_30: string
  rata_2_postava_stolarije_20: string
  rata_3_obrtnicki_radovi_20: string
  rata_4_uporabna_20: string
  kredit_etaziranje_90: string
}

export const emptyContractFields = (): ContractFields => ({
  datum_potpisa_predugovora: '',
  contract_payment_type: '',
  kapara_10_posto: '',
  rata_1_ab_konstrukcija_30: '',
  rata_2_postava_stolarije_20: '',
  rata_3_obrtnicki_radovi_20: '',
  rata_4_uporabna_20: '',
  kredit_etaziranje_90: ''
})

export const contractFieldsFromData = (data: any): ContractFields => ({
  datum_potpisa_predugovora: data?.datum_potpisa_predugovora || '',
  contract_payment_type: data?.contract_payment_type || '',
  kapara_10_posto: data?.kapara_10_posto || '',
  rata_1_ab_konstrukcija_30: data?.rata_1_ab_konstrukcija_30 || '',
  rata_2_postava_stolarije_20: data?.rata_2_postava_stolarije_20 || '',
  rata_3_obrtnicki_radovi_20: data?.rata_3_obrtnicki_radovi_20 || '',
  rata_4_uporabna_20: data?.rata_4_uporabna_20 || '',
  kredit_etaziranje_90: data?.kredit_etaziranje_90 || ''
})

export const contractFieldsToPayload = (fields: ContractFields) => ({
  datum_potpisa_predugovora: fields.datum_potpisa_predugovora || null,
  contract_payment_type: (fields.contract_payment_type as 'credit' | 'installments') || null,
  kapara_10_posto: fields.kapara_10_posto || null,
  rata_1_ab_konstrukcija_30: fields.rata_1_ab_konstrukcija_30 || null,
  rata_2_postava_stolarije_20: fields.rata_2_postava_stolarije_20 || null,
  rata_3_obrtnicki_radovi_20: fields.rata_3_obrtnicki_radovi_20 || null,
  rata_4_uporabna_20: fields.rata_4_uporabna_20 || null,
  kredit_etaziranje_90: fields.kredit_etaziranje_90 || null
})

interface ContractedSectionProps {
  value: ContractFields
  onChange: (fields: ContractFields) => void
}

export const ContractedSection: React.FC<ContractedSectionProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false)

  const set = (partial: Partial<ContractFields>) => onChange({ ...value, ...partial })

  const handlePaymentTypeChange = (type: 'credit' | 'installments' | '') => {
    set({
      contract_payment_type: type,
      rata_1_ab_konstrukcija_30: '',
      rata_2_postava_stolarije_20: '',
      rata_3_obrtnicki_radovi_20: '',
      rata_4_uporabna_20: '',
      kredit_etaziranje_90: ''
    })
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors duration-150 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">Contracted</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-500" />
          : <ChevronRight className="w-4 h-4 text-gray-500" />
        }
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Datum potpisa predugovora">
              <Input
                type="date"
                value={value.datum_potpisa_predugovora}
                onChange={(e) => set({ datum_potpisa_predugovora: e.target.value })}
              />
            </FormField>

            <FormField label="Payment Type">
              <Select
                value={value.contract_payment_type}
                onChange={(e) => handlePaymentTypeChange(e.target.value as 'credit' | 'installments' | '')}
              >
                <option value="">— Select —</option>
                <option value="credit">Credit</option>
                <option value="installments">Installments</option>
              </Select>
            </FormField>
          </div>

          {value.contract_payment_type && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <FormField label="Kapara 10%">
                <Input
                  type="date"
                  value={value.kapara_10_posto}
                  onChange={(e) => set({ kapara_10_posto: e.target.value })}
                />
              </FormField>

              {value.contract_payment_type === 'installments' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="1. rata AB konstrukcija 30%">
                      <Input
                        type="date"
                        value={value.rata_1_ab_konstrukcija_30}
                        onChange={(e) => set({ rata_1_ab_konstrukcija_30: e.target.value })}
                      />
                    </FormField>
                    <FormField label="2. rata postava stolarije 20%">
                      <Input
                        type="date"
                        value={value.rata_2_postava_stolarije_20}
                        onChange={(e) => set({ rata_2_postava_stolarije_20: e.target.value })}
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="3. rata obrtnički radovi 20%">
                      <Input
                        type="date"
                        value={value.rata_3_obrtnicki_radovi_20}
                        onChange={(e) => set({ rata_3_obrtnicki_radovi_20: e.target.value })}
                      />
                    </FormField>
                    <FormField label="4. rata uporabna 20%">
                      <Input
                        type="date"
                        value={value.rata_4_uporabna_20}
                        onChange={(e) => set({ rata_4_uporabna_20: e.target.value })}
                      />
                    </FormField>
                  </div>
                </>
              )}

              {value.contract_payment_type === 'credit' && (
                <FormField label="Kredit etažiranje 90% ili manje">
                  <Input
                    type="date"
                    value={value.kredit_etaziranje_90}
                    onChange={(e) => set({ kredit_etaziranje_90: e.target.value })}
                  />
                </FormField>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
