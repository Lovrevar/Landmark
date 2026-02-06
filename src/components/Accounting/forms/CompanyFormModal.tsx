import React from 'react'
import { X } from 'lucide-react'
import { CompanyFormData } from '../types/companyTypes'

interface CompanyFormModalProps {
  show: boolean
  editingCompany: string | null
  formData: CompanyFormData
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onAccountCountChange: (count: number) => void
  onBankAccountChange: (index: number, field: 'bank_name' | 'initial_balance', value: string | number) => void
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
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {editingCompany ? 'Uredi firmu' : 'Nova firma'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Naziv firme *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => onFormDataChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="npr. Landmark d.o.o."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OIB *
              </label>
              <input
                type="text"
                value={formData.oib}
                onChange={(e) => onFormDataChange('oib', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="12345678901"
                maxLength={11}
                pattern="[0-9]{11}"
                title="OIB mora imati točno 11 brojeva"
              />
              <p className="text-xs text-gray-500 mt-1">Unesite 11-znamenkasti OIB</p>
            </div>

            {!editingCompany && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Broj bankovnih računa *
                </label>
                <select
                  value={formData.accountCount}
                  onChange={(e) => onAccountCountChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Odaberite broj bankovnih računa</p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Bankovni računi</h3>
              {formData.bankAccounts.map((account, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700">Račun #{index + 1}</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Naziv banke *
                    </label>
                    <input
                      type="text"
                      value={account.bank_name}
                      onChange={(e) => onBankAccountChange(index, 'bank_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      required
                      placeholder="npr. Erste banka"
                      disabled={editingCompany !== null}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Početno stanje (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={account.initial_balance}
                      onChange={(e) => onBankAccountChange(index, 'initial_balance', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      required
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                {editingCompany ? (
                  <>
                    <strong>Napomena:</strong> Možete promijeniti početna stanja računa. Current balance će se preračunati
                    automatski na osnovu novih početnih stanja.
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

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              {editingCompany ? 'Spremi promjene' : 'Dodaj firmu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CompanyFormModal
