import React from 'react'
import { Modal, Button, Input, Select, FormField } from '../../ui'
import { CompanyFormData } from '../types/companyTypes'

interface CompanyFormModalProps {
  show: boolean
  editingCompany: string | null
  formData: CompanyFormData
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onAccountCountChange: (count: number) => void
  onBankAccountChange: (index: number, field: 'bank_name' | 'current_balance', value: string | number) => void
  onFormDataChange: (field: keyof CompanyFormData, value: any) => void
}

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  show,
  editingCompany,
  formData,
  onClose,
  onSubmit,
  onAccountCountChange,
  onBankAccountChange,
  onFormDataChange
}) => {
  return (
    <Modal show={show} onClose={onClose} size="sm">
      <Modal.Header
        title={editingCompany ? 'Uredi firmu' : 'Nova firma'}
        onClose={onClose}
      />

      <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
        <div className="p-6 space-y-4">
          <FormField label="Naziv firme" required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => onFormDataChange('name', e.target.value)}
              required
              placeholder="npr. Landmark d.o.o."
            />
          </FormField>

          <FormField label="OIB" required helperText="Unesite 11-znamenkasti OIB">
            <Input
              type="text"
              value={formData.oib}
              onChange={(e) => onFormDataChange('oib', e.target.value)}
              required
              placeholder="12345678901"
              maxLength={11}
              pattern="[0-9]{11}"
              title="OIB mora imati točno 11 brojeva"
            />
          </FormField>

          {!editingCompany && (
            <FormField label="Broj bankovnih računa" required helperText="Odaberite broj bankovnih računa">
              <Select
                value={formData.accountCount}
                onChange={(e) => onAccountCountChange(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </FormField>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Bankovni računi</h3>
            {formData.bankAccounts.map((account, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-700">Račun #{index + 1}</p>
                <FormField label="Naziv banke" required compact>
                  <Input
                    type="text"
                    compact
                    value={account.bank_name}
                    onChange={(e) => onBankAccountChange(index, 'bank_name', e.target.value)}
                    required
                    placeholder="npr. Erste banka"
                    disabled={editingCompany !== null}
                  />
                </FormField>
                <FormField label="Trenutno stanje (€)" required compact>
                  <Input
                    type="number"
                    compact
                    step="0.01"
                    value={account.current_balance}
                    onChange={(e) => onBankAccountChange(index, 'current_balance', parseFloat(e.target.value) || 0)}
                    required
                    placeholder="0.00"
                  />
                </FormField>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              {editingCompany ? (
                <>
                  <strong>Napomena:</strong> Možete promijeniti trenutna stanja računa. Promjene će biti vidljive odmah.
                </>
              ) : (
                <>
                  <strong>Napomena:</strong> Nakon dodavanja firme i bankovnih računa, svaki račun će se automatski
                  ažurirati kada izdajete ili plaćate račune.
                </>
              )}
            </p>
          </div>
        </div>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit">
            {editingCompany ? 'Spremi promjene' : 'Dodaj firmu'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default CompanyFormModal
