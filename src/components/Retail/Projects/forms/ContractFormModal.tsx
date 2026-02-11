import React, { useState, useEffect } from 'react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailContract, RetailSupplier, RetailProjectPhase } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea } from '../../../../components/ui'
import { SupplierFormModal } from './SupplierFormModal'

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
    notes: contract?.notes || '',
    has_contract: contract?.has_contract ?? true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const data = await retailProjectService.fetchSuppliers()
      setSuppliers(data)
    } catch (err) {
      console.error('Error loading suppliers:', err)
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

      let contractNumber = formData.contract_number
      if (!contract) {
        contractNumber = await retailProjectService.generateContractNumber(phase.project_id)
      }

      const dataToSubmit = {
        phase_id: phase.id,
        supplier_id: formData.supplier_id,
        contract_number: contractNumber,
        contract_amount: formData.has_contract ? parseFloat(formData.contract_amount) : 0,
        status: formData.status as 'Active' | 'Completed' | 'Cancelled',
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        notes: formData.notes || null,
        has_contract: formData.has_contract
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

  const handleSupplierCreated = async () => {
    await loadSuppliers()
    setShowAddSupplier(false)
    const updatedSuppliers = await retailProjectService.fetchSuppliers()
    if (updatedSuppliers.length > 0) {
      const latestSupplier = updatedSuppliers[updatedSuppliers.length - 1]
      setFormData(prev => ({ ...prev, supplier_id: latestSupplier.id }))
    }
  }

  return (
    <>
      {showAddSupplier && (
        <SupplierFormModal
          onClose={() => setShowAddSupplier(false)}
          onSuccess={handleSupplierCreated}
        />
      )}

      <Modal show={true} onClose={onClose} size="lg">
        <Modal.Header
          title={contract ? 'Uredi ugovor' : 'Novi ugovor'}
          subtitle={`Faza: ${phase.phase_name}`}
          onClose={onClose}
        />
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormField label="Dobavljač *">
                  <div className="flex space-x-2">
                    <Select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="flex-1"
                      required
                    >
                      <option value="">Odaberi dobavljača...</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} - {supplier.supplier_type?.name || 'N/A'}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="success"
                      onClick={handleAddSupplierClick}
                    >
                      + Novi
                    </Button>
                  </div>
                </FormField>
              </div>

            <div className="md:col-span-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_contract}
                  onChange={(e) => setFormData({ ...formData, has_contract: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium text-gray-700">Postoji formalni ugovor</span>
              </label>
              {!formData.has_contract && (
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Koristite ovu opciju za praćenje dobavljača bez formalnog ugovora
                </p>
              )}
            </div>

            <FormField label="Status">
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </Select>
            </FormField>

            <FormField label="Iznos ugovora (€) *">
              <Input
                type="number"
                step="0.01"
                value={formData.has_contract ? formData.contract_amount : '0'}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                required={formData.has_contract}
                disabled={!formData.has_contract}
                className={!formData.has_contract ? 'bg-gray-100 cursor-not-allowed' : ''}
              />
            </FormField>

            <FormField label="Datum početka">
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>

            <FormField label="Deadline">
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Napomene">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </FormField>
            </div>
          </div>

          {!contract && (
            <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Napomena:</strong> Nakon kreiranja ugovora, moći ćete dodati milestoneove za raspodjelu po kupcima.
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Odustani
          </Button>
          <Button type="submit" loading={loading}>
            {contract ? 'Spremi promjene' : 'Kreiraj ugovor'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
    </>
  )
}
