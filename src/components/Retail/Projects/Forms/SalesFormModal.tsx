import React, { useState, useEffect } from 'react'
import { retailProjectService } from '../Services/retailProjectService'
import type { RetailContract, RetailProjectPhase } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea } from '../../../ui'

interface RetailCustomer {
  id: string
  name: string
  contact_phone?: string
  contact_email?: string
  oib?: string
  address?: string
}

interface SalesFormModalProps {
  phase: RetailProjectPhase
  onClose: () => void
  onSuccess: () => void
  contract?: RetailContract
}

export const SalesFormModal: React.FC<SalesFormModalProps> = ({
  phase,
  onClose,
  onSuccess,
  contract
}) => {
  const [customers, setCustomers] = useState<RetailCustomer[]>([])
  const [formData, setFormData] = useState({
    customer_id: contract?.customer_id || '',
    contract_number: contract?.contract_number || '',
    contract_amount: contract?.contract_amount?.toString() || '',
    building_surface_m2: contract?.building_surface_m2?.toString() || '',
    total_surface_m2: contract?.total_surface_m2?.toString() || '',
    price_per_m2: contract?.price_per_m2?.toString() || '',
    contract_date: contract?.contract_date || '',
    start_date: contract?.start_date || '',
    end_date: contract?.end_date || '',
    status: contract?.status || 'Active',
    notes: contract?.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCustomers()
    if (!contract) {
      generateContractNumber()
    }
  }, [])

  useEffect(() => {
    const amount = parseFloat(formData.contract_amount)
    const surface = parseFloat(formData.total_surface_m2)

    if (amount > 0 && surface > 0) {
      const pricePerM2 = (amount / surface).toFixed(2)
      setFormData(prev => ({ ...prev, price_per_m2: pricePerM2 }))
    } else {
      setFormData(prev => ({ ...prev, price_per_m2: '' }))
    }
  }, [formData.contract_amount, formData.total_surface_m2])

  const loadCustomers = async () => {
    try {
      const data = await retailProjectService.fetchCustomers()
      setCustomers(data)
    } catch (err) {
      console.error('Error loading customers:', err)
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
      if (!formData.customer_id) {
        throw new Error('Morate odabrati kupca')
      }

      if (!formData.contract_amount) {
        throw new Error('Morate unijeti cijenu ugovora')
      }

      if (!formData.contract_date) {
        throw new Error('Morate unijeti datum ugovora')
      }

      const dataToSubmit = {
        phase_id: phase.id,
        customer_id: formData.customer_id,
        contract_number: formData.contract_number,
        contract_amount: parseFloat(formData.contract_amount),
        building_surface_m2: formData.building_surface_m2 ? parseFloat(formData.building_surface_m2) : null,
        total_surface_m2: formData.total_surface_m2 ? parseFloat(formData.total_surface_m2) : null,
        price_per_m2: formData.price_per_m2 ? parseFloat(formData.price_per_m2) : null,
        contract_date: formData.contract_date,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status as 'Active' | 'Completed' | 'Cancelled',
        notes: formData.notes || null,
        land_area_m2: null,
        supplier_id: null
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
    <Modal show={true} onClose={onClose}>
      <Modal.Header
        title={contract ? 'Uredi kupca' : 'Novi kupac'}
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
              <strong>Napomena:</strong> Dodajte kupce (najmodavce) koji će plaćati najamninu za prostor u retail centru.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Kupac (Najmodavac)"
              required
              helperText='Ako kupac ne postoji, dodajte ga prvo preko "Kupci" menija'
              className="md:col-span-2"
            >
              <Select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                required
              >
                <option value="">Odaberi kupca...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Broj ugovora" required>
              <Input
                type="text"
                value={formData.contract_number}
                onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                className="bg-gray-50"
                required
                readOnly={!!contract}
              />
            </FormField>

            <FormField label="Datum ugovora" required>
              <Input
                type="date"
                value={formData.contract_date}
                onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Cijena ugovora (€)" required>
              <Input
                type="number"
                step="0.01"
                value={formData.contract_amount}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                placeholder="npr. 500000"
                required
              />
            </FormField>

            <FormField label="Površina objekta (m²)" helperText="Površina samog objekta/prostora">
              <Input
                type="number"
                step="0.01"
                value={formData.building_surface_m2}
                onChange={(e) => setFormData({ ...formData, building_surface_m2: e.target.value })}
                placeholder="npr. 350"
              />
            </FormField>

            <FormField label="Površina ukupno (m²)" helperText="Ukupna površina (sa parkingom, skladištem...)">
              <Input
                type="number"
                step="0.01"
                value={formData.total_surface_m2}
                onChange={(e) => setFormData({ ...formData, total_surface_m2: e.target.value })}
                placeholder="npr. 500"
              />
            </FormField>

            <FormField
              label="Cijena po m² (€)"
              helperText={formData.price_per_m2
                ? 'Izračunato: Cijena ugovora ÷ Površina ukupno'
                : 'Unesite cijenu i površinu za automatski izračun'
              }
            >
              <Input
                type="number"
                step="0.01"
                value={formData.price_per_m2}
                className="bg-gray-50 font-semibold"
                placeholder="Automatski izračunato"
                readOnly
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

            <FormField label="Datum početka">
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>

            <FormField label="Datum završetka">
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>

            <FormField label="Napomene" className="md:col-span-2">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Dodatne informacije o ugovoru..."
              />
            </FormField>
          </div>

          {!contract && (
            <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Napomena:</strong> Nakon kreiranja ugovora, možete dodati milestones plaćanja kroz žutu tipku (📊).
              </p>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Odustani
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
          >
            {contract ? 'Spremi promjene' : 'Kreiraj ugovor'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
