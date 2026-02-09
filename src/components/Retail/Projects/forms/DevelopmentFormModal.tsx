import React, { useState, useEffect } from 'react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailContract, RetailSupplier, RetailProjectPhase } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea } from '../../../../components/ui'

interface DevelopmentFormModalProps {
  phase: RetailProjectPhase
  onClose: () => void
  onSuccess: () => void
  contract?: RetailContract
}

export const DevelopmentFormModal: React.FC<DevelopmentFormModalProps> = ({
  phase,
  onClose,
  onSuccess,
  contract
}) => {
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>([])
  const [formData, setFormData] = useState({
    supplier_id: contract?.supplier_id || '',
    contract_number: contract?.contract_number || '',
    contract_amount: contract?.contract_amount?.toString() || '',
    contract_date: contract?.contract_date || '',
    notes: contract?.notes || '',
    status: contract?.status || 'Active',
    has_contract: contract?.has_contract ?? true
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

      if (!formData.contract_date) {
        throw new Error('Morate unijeti datum ugovora')
      }

      const dataToSubmit = {
        phase_id: phase.id,
        supplier_id: formData.supplier_id,
        contract_number: formData.contract_number,
        contract_amount: formData.has_contract ? parseFloat(formData.contract_amount) : 0,
        contract_date: formData.contract_date,
        status: formData.status as 'Active' | 'Completed' | 'Cancelled',
        start_date: null,
        end_date: null,
        land_area_m2: null,
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

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={contract ? 'Uredi dobavljača' : 'Novi dobavljač'}
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

          <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Napomena:</strong> Dodajte dobavljače za fazu razvoja (arhitekti, geodeti, projektanti, itd.)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label="Dobavljač *">
                <Select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  required
                >
                  <option value="">Odaberi dobavljača...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} - {supplier.supplier_type}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Ako dobavljač ne postoji, dodajte ga prvo preko "Dobavljači" menija
                </p>
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

            <FormField label="Broj ugovora *">
              <Input
                type="text"
                value={formData.contract_number}
                onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                className="bg-gray-50"
                required
                readOnly={!!contract}
              />
            </FormField>

            <FormField label="Datum ugovora *">
              <Input
                type="date"
                value={formData.contract_date}
                onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Cijena ugovora (€) *">
              <Input
                type="number"
                step="0.01"
                value={formData.has_contract ? formData.contract_amount : '0'}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                placeholder="npr. 50000"
                required={formData.has_contract}
                disabled={!formData.has_contract}
                className={!formData.has_contract ? 'bg-gray-100 cursor-not-allowed' : ''}
              />
            </FormField>

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

            <div className="md:col-span-2">
              <FormField label="Opis *">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Opis usluge... (npr. Izrada projektne dokumentacije, Geodetski snimak, itd.)"
                  required
                />
              </FormField>
            </div>
          </div>

          {!contract && (
            <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Napomena:</strong> Nakon kreiranja ugovora, moći ćete dodati plaćanja kroz Accounting modul.
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
  )
}
