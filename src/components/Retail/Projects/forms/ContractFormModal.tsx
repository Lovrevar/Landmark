import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailContract, RetailSupplier, RetailProjectPhase } from '../../../../types/retail'

interface ContractFormModalProps {
  phase: RetailProjectPhase
  onClose: () => void
  onSuccess: () => void
  contract?: RetailContract
}

export const ContractFormModal: React.FC<ContractFormModalProps> = ({
  phase,
  onClose,
  onSuccess,
  contract
}) => {
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>([])
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [formData, setFormData] = useState({
    supplier_id: contract?.supplier_id || '',
    contract_number: contract?.contract_number || '',
    contract_amount: contract?.contract_amount?.toString() || '',
    status: contract?.status || 'Active',
    start_date: contract?.start_date || '',
    end_date: contract?.end_date || '',
    notes: contract?.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSuppliers()
    if (!contract) {
      generateContractNumber()
    }
  }, [])

  const loadSuppliers = async () => {
    try {
      const data = await retailProjectService.fetchSuppliers()
      setSuppliers(data)
    } catch (err) {
      console.error('Error loading suppliers:', err)
    }
  }

  const generateContractNumber = async () => {
    try {
      const number = await retailProjectService.generateContractNumber()
      setFormData(prev => ({ ...prev, contract_number: number }))
    } catch (err) {
      console.error('Error generating contract number:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.supplier_id) {
        throw new Error('Morate odabrati dobavljača')
      }

      const dataToSubmit = {
        phase_id: phase.id,
        supplier_id: formData.supplier_id,
        contract_number: formData.contract_number,
        contract_amount: parseFloat(formData.contract_amount),
        status: formData.status as 'Active' | 'Completed' | 'Cancelled',
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        notes: formData.notes || null
      }

      if (contract) {
        await retailProjectService.updateContract(contract.id, dataToSubmit)
      } else {
        await retailProjectService.createContract(dataToSubmit)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri spremanju ugovora')
      console.error('Error saving contract:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSupplierClick = () => {
    setShowAddSupplier(true)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {contract ? 'Uredi ugovor' : 'Novi ugovor'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Faza: {phase.phase_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dobavljač *
              </label>
              <div className="flex space-x-2">
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Odaberi dobavljača...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} - {supplier.supplier_type}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddSupplierClick}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                >
                  + Novi
                </button>
              </div>
              {showAddSupplier && (
                <p className="text-xs text-blue-600 mt-1">
                  Dodavanje novog dobavljača će biti omogućeno kroz modal
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Broj ugovora *
              </label>
              <input
                type="text"
                value={formData.contract_number}
                onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                readOnly={!!contract}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Iznos ugovora (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.contract_amount}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum početka
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Napomene
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {!contract && (
            <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Napomena:</strong> Nakon kreiranja ugovora, moći ćete dodati milestoneove za raspodjelu po kupcima.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Spremam...' : contract ? 'Spremi promjene' : 'Kreiraj ugovor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
