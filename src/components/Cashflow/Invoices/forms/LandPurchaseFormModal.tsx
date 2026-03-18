import React, { useState, useEffect } from 'react'
import { Button, Modal, Form } from '../../../ui'
import CurrencyInput from '../../../Common/CurrencyInput'
import DateInput from '../../../Common/DateInput'
import { useLandPurchaseFormData, Contract } from '../hooks/useLandPurchaseFormData'
import { createLandPurchaseInvoices, LandPurchaseFormData } from '../services/landPurchaseService'
import { useToast } from '../../../../contexts/ToastContext'

interface LandPurchaseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const LandPurchaseFormModal: React.FC<LandPurchaseFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [projectType, setProjectType] = useState<'projects' | 'retail'>('projects')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  const [formData, setFormData] = useState<LandPurchaseFormData>({
    company_id: '',
    supplier_id: '',
    project_id: '',
    phase_id: '',
    contract_id: '',
    invoice_name: '',
    iban: '',
    deposit_amount: 0,
    deposit_due_date: new Date().toISOString().split('T')[0],
    remaining_amount: 0,
    remaining_due_date: new Date().toISOString().split('T')[0]
  })

  const { companies, suppliers, projects, phases, availableContracts } = useLandPurchaseFormData(
    projectType,
    formData.supplier_id || null,
    formData.project_id || null,
    formData.phase_id || null,
    isOpen
  )

  // Reset dependent fields when projectType changes
  useEffect(() => {
    setFormData(prev => ({
      company_id: prev.company_id,
      supplier_id: '',
      project_id: '',
      phase_id: '',
      contract_id: '',
      invoice_name: '',
      iban: prev.iban,
      deposit_amount: 0,
      deposit_due_date: new Date().toISOString().split('T')[0],
      remaining_amount: 0,
      remaining_due_date: new Date().toISOString().split('T')[0]
    }))
    setSelectedContract(null)
  }, [projectType])

  // Reset project/phase/contract when supplier changes
  useEffect(() => {
    if (!formData.supplier_id) {
      setFormData(prev => ({ ...prev, project_id: '', phase_id: '', contract_id: '' }))
    }
  }, [formData.supplier_id])

  // Reset phase/contract when project changes
  useEffect(() => {
    if (!formData.project_id) {
      setFormData(prev => ({ ...prev, phase_id: '', contract_id: '' }))
    }
  }, [formData.project_id])

  // Reset contract when phase changes
  useEffect(() => {
    if (!formData.phase_id) {
      setAvailableContractSelection(null)
      setFormData(prev => ({ ...prev, contract_id: '', deposit_amount: 0, remaining_amount: 0 }))
    }
  }, [formData.phase_id])

  // Update selectedContract when contract_id changes
  useEffect(() => {
    if (formData.contract_id) {
      const contract = availableContracts.find(c => c.id === formData.contract_id)
      setSelectedContract(contract || null)
    } else {
      setSelectedContract(null)
      setFormData(prev => ({ ...prev, deposit_amount: 0, remaining_amount: 0 }))
    }
  }, [formData.contract_id, availableContracts])

  // Dummy setter to avoid lint about setSelectedContract not being used in the phase effect
  const setAvailableContractSelection = (val: Contract | null) => setSelectedContract(val)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { company_id, supplier_id, invoice_name, deposit_amount, remaining_amount } = formData
    const errors: Record<string, string> = {}
    if (!company_id) errors.company_id = 'Firma je obavezna'
    if (!supplier_id) errors.supplier_id = 'Dobavljač je obavezan'
    if (!selectedContract) errors.contract_id = 'Ugovor je obavezan'
    if (!invoice_name.trim()) errors.invoice_name = 'Ime računa je obavezno'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)

    try {
      const totalAmount = deposit_amount + remaining_amount
      if (Math.abs(totalAmount - selectedContract!.base_amount) > 0.01) {
        setLoading(false)
        return
      }

      await createLandPurchaseInvoices(formData, projectType, selectedContract!)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error creating land purchase invoices:', error)
      toast.error('Greška pri kreiranju računa')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      company_id: '',
      supplier_id: '',
      project_id: '',
      phase_id: '',
      contract_id: '',
      invoice_name: '',
      iban: '',
      deposit_amount: 0,
      deposit_due_date: new Date().toISOString().split('T')[0],
      remaining_amount: 0,
      remaining_due_date: new Date().toISOString().split('T')[0]
    })
    setSelectedContract(null)
    setProjectType('projects')
    onClose()
  }

  const totalAmount = formData.deposit_amount + formData.remaining_amount
  const contractAmount = selectedContract?.base_amount || 0
  const amountMismatch = selectedContract && Math.abs(totalAmount - contractAmount) > 0.01

  return (
    <Modal show={isOpen} onClose={handleClose} size="xl">
      <Modal.Header title="Kupoprodaja Zemljišta" onClose={handleClose} />

      <Form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <Modal.Body>
        <div className="bg-slate-50 p-5 rounded-lg mb-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-slate-800">Tip Projekta</h3>
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
              <button
                type="button"
                onClick={() => setProjectType('projects')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  projectType === 'projects'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Projekti
              </button>
              <button
                type="button"
                onClick={() => setProjectType('retail')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  projectType === 'retail'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Retail
              </button>
            </div>
          </div>

          <h3 className="text-base font-semibold text-slate-800 mb-4">Osnovni Podaci</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Firma *
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Odaberite firmu</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {fieldErrors.company_id && <p className="text-xs text-red-600 mt-1">{fieldErrors.company_id}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {projectType === 'retail' ? 'Retail Dobavljač *' : 'Dobavljač *'}
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value, project_id: '', phase_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Odaberite {projectType === 'retail' ? 'retail dobavljača' : 'dobavljača'}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {fieldErrors.supplier_id && <p className="text-xs text-red-600 mt-1">{fieldErrors.supplier_id}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {projectType === 'retail' ? 'Retail Projekt *' : 'Projekt *'}
              </label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-slate-100"
                disabled={!formData.supplier_id}
              >
                <option value="">Odaberite {projectType === 'retail' ? 'retail projekt' : 'projekt'}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Faza *
              </label>
              <select
                value={formData.phase_id}
                onChange={(e) => setFormData({ ...formData, phase_id: e.target.value, contract_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-slate-100"
                disabled={!formData.project_id}
              >
                <option value="">Odaberite fazu</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.phase_name}
                  </option>
                ))}
              </select>
            </div>

            {availableContracts.length > 0 && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ugovor *
                </label>
                <select
                  value={formData.contract_id}
                  onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Odaberite ugovor</option>
                  {availableContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_number} - {contract.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
                    </option>
                  ))}
                </select>
                {fieldErrors.contract_id && <p className="text-xs text-red-600 mt-1">{fieldErrors.contract_id}</p>}
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                IBAN
              </label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="HR..."
              />
            </div>
          </div>

          {selectedContract && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600">Broj ugovora:</span>
                  <span className="ml-2 font-semibold text-slate-800">{selectedContract.contract_number}</span>
                </div>
                <div>
                  <span className="text-slate-600">Iznos ugovora:</span>
                  <span className="ml-2 font-semibold text-blue-700">
                    {selectedContract.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedContract && (
          <div className="bg-slate-50 p-5 rounded-lg mb-5">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Ime Računa</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Ime Računa *
              </label>
              <input
                type="text"
                value={formData.invoice_name}
                onChange={(e) => setFormData({ ...formData, invoice_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="npr. Zemljište Kozara"
              />
              {fieldErrors.invoice_name && <p className="text-xs text-red-600 mt-1">{fieldErrors.invoice_name}</p>}
              <p className="text-xs text-slate-500 mt-1.5">
                Računi će biti kreirani kao: <span className="font-semibold">{formData.invoice_name || '(ime)'}-Kapara</span> i <span className="font-semibold">{formData.invoice_name || '(ime)'}-Preostalo</span>
              </p>
            </div>
          </div>
        )}

        {selectedContract && (
          <>
            <div className="bg-green-50 p-5 rounded-lg mb-5 border border-green-200">
              <h3 className="text-base font-semibold text-green-900 mb-4">Kapara</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Iznos Kapare *
                  </label>
                  <CurrencyInput
                    value={formData.deposit_amount}
                    onChange={(value) => setFormData({ ...formData, deposit_amount: value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Datum Dospijeća *
                  </label>
                  <DateInput
                    value={formData.deposit_due_date}
                    onChange={(value) => setFormData({ ...formData, deposit_due_date: value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-5 rounded-lg mb-5 border border-orange-200">
              <h3 className="text-base font-semibold text-orange-900 mb-4">Preostali Iznos</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Iznos Preostalog *
                  </label>
                  <CurrencyInput
                    value={formData.remaining_amount}
                    onChange={(value) => setFormData({ ...formData, remaining_amount: value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Datum Dospijeća *
                  </label>
                  <DateInput
                    value={formData.remaining_due_date}
                    onChange={(value) => setFormData({ ...formData, remaining_due_date: value })}
                  />
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${amountMismatch ? 'bg-red-50 border border-red-300' : 'bg-blue-50'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-lg font-semibold text-slate-700">Sveukupno:</span>
                  {amountMismatch && (
                    <p className="text-sm text-red-600 mt-1">
                      Zbir mora biti {contractAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
                    </p>
                  )}
                </div>
                <span className={`text-2xl font-bold ${amountMismatch ? 'text-red-600' : 'text-blue-600'}`}>
                  {totalAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            </div>
          </>
        )}

        {formData.phase_id && availableContracts.length === 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">Nema pronađenog ugovora za odabranu kombinaciju (dobavljač + projekt + faza).</p>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button
          type="button"
          variant="secondary"
          onClick={handleClose}
          disabled={loading}
        >
          Odustani
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={loading || !selectedContract || !!amountMismatch}
        >
          {loading ? 'Spremanje...' : 'Kreiraj Račune'}
        </Button>
      </Modal.Footer>
      </Form>
    </Modal>
  )
}
