import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { Button, Modal } from '../../ui'
import CurrencyInput from '../../Common/CurrencyInput'
import DateInput from '../../Common/DateInput'

interface LandPurchaseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Supplier {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
}

interface Phase {
  id: string
  phase_name: string
  project_id: string
}

export const LandPurchaseFormModal: React.FC<LandPurchaseFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])

  const [formData, setFormData] = useState({
    supplier_id: '',
    project_id: '',
    phase_id: '',
    contract_number: '',
    iban: '',
    contract_date: new Date().toISOString().split('T')[0],
    deposit_amount: 0,
    deposit_due_date: new Date().toISOString().split('T')[0],
    remaining_amount: 0,
    remaining_due_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  useEffect(() => {
    if (formData.project_id) {
      fetchPhases(formData.project_id)
    } else {
      setPhases([])
      setFormData(prev => ({ ...prev, phase_id: '' }))
    }
  }, [formData.project_id])

  const fetchData = async () => {
    const [suppliersRes, projectsRes] = await Promise.all([
      supabase.from('subcontractors').select('id, name').order('name'),
      supabase.from('projects').select('id, name').order('name')
    ])

    if (suppliersRes.data) setSuppliers(suppliersRes.data)
    if (projectsRes.data) setProjects(projectsRes.data)
  }

  const fetchPhases = async (projectId: string) => {
    const { data } = await supabase
      .from('project_phases')
      .select('id, phase_name, project_id')
      .eq('project_id', projectId)
      .order('phase_name')

    if (data) setPhases(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { supplier_id, project_id, phase_id, contract_number, iban, contract_date, deposit_amount, deposit_due_date, remaining_amount, remaining_due_date } = formData

      if (!supplier_id || !project_id || !phase_id || !contract_number) {
        alert('Molimo popunite sva obavezna polja')
        setLoading(false)
        return
      }

      const { data: existingContract } = await supabase
        .from('contracts')
        .select('id')
        .eq('subcontractor_id', supplier_id)
        .eq('project_id', project_id)
        .eq('phase_id', phase_id)
        .maybeSingle()

      let contractId = existingContract?.id

      if (!contractId) {
        const { data: newContract, error: contractError } = await supabase
          .from('contracts')
          .insert({
            contract_number: contract_number,
            project_id: project_id,
            phase_id: phase_id,
            subcontractor_id: supplier_id,
            job_description: 'Kupoprodaja zemljišta',
            contract_amount: deposit_amount + remaining_amount,
            base_amount: deposit_amount + remaining_amount,
            vat_rate: 0,
            vat_amount: 0,
            total_amount: deposit_amount + remaining_amount,
            budget_realized: 0,
            status: 'active',
            has_contract: true,
            contract_type_id: 0,
            end_date: null,
            contract_date: contract_date
          })
          .select('id')
          .single()

        if (contractError) throw contractError
        contractId = newContract.id
      }

      const invoicesToCreate = []

      if (deposit_amount > 0) {
        invoicesToCreate.push({
          invoice_number: `${contract_number} - Kapara`,
          entity_type: 'subcontractor',
          entity_id: supplier_id,
          contract_id: contractId,
          project_id: project_id,
          category: 'supervision',
          type: 'incoming',
          base_amount: deposit_amount,
          vat_rate: 0,
          vat_amount: 0,
          total_amount: deposit_amount,
          due_date: deposit_due_date,
          invoice_date: contract_date,
          payment_status: 'unpaid',
          investor_bank: iban,
          approved: false
        })
      }

      if (remaining_amount > 0) {
        invoicesToCreate.push({
          invoice_number: `${contract_number} - Preostalo`,
          entity_type: 'subcontractor',
          entity_id: supplier_id,
          contract_id: contractId,
          project_id: project_id,
          category: 'supervision',
          type: 'incoming',
          base_amount: remaining_amount,
          vat_rate: 0,
          vat_amount: 0,
          total_amount: remaining_amount,
          due_date: remaining_due_date,
          invoice_date: contract_date,
          payment_status: 'unpaid',
          investor_bank: iban,
          approved: false
        })
      }

      if (invoicesToCreate.length > 0) {
        const { error: invoiceError } = await supabase
          .from('accounting_invoices')
          .insert(invoicesToCreate)

        if (invoiceError) throw invoiceError
      }

      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error creating land purchase invoices:', error)
      alert('Greška pri kreiranju računa')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      supplier_id: '',
      project_id: '',
      phase_id: '',
      contract_number: '',
      iban: '',
      contract_date: new Date().toISOString().split('T')[0],
      deposit_amount: 0,
      deposit_due_date: new Date().toISOString().split('T')[0],
      remaining_amount: 0,
      remaining_due_date: new Date().toISOString().split('T')[0]
    })
    onClose()
  }

  const totalAmount = formData.deposit_amount + formData.remaining_amount

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Kupoprodaja Zemljišta</h2>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dobavljač *
            </label>
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Odaberite dobavljača</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Projekt *
            </label>
            <select
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Odaberite projekt</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Faza *
            </label>
            <select
              value={formData.phase_id}
              onChange={(e) => setFormData({ ...formData, phase_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Broj Ugovora *
            </label>
            <input
              type="text"
              value={formData.contract_number}
              onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              IBAN
            </label>
            <input
              type="text"
              value={formData.iban}
              onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Datum Ugovora *
            </label>
            <DateInput
              value={formData.contract_date}
              onChange={(value) => setFormData({ ...formData, contract_date: value })}
              required
            />
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Kapara</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Iznos Kapare *
              </label>
              <CurrencyInput
                value={formData.deposit_amount}
                onChange={(value) => setFormData({ ...formData, deposit_amount: value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Datum Dospijeća Kapare *
              </label>
              <DateInput
                value={formData.deposit_due_date}
                onChange={(value) => setFormData({ ...formData, deposit_due_date: value })}
                required
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Preostalo</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Iznos Preostalog *
              </label>
              <CurrencyInput
                value={formData.remaining_amount}
                onChange={(value) => setFormData({ ...formData, remaining_amount: value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Datum Dospijeća Preostalog *
              </label>
              <DateInput
                value={formData.remaining_due_date}
                onChange={(value) => setFormData({ ...formData, remaining_due_date: value })}
                required
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 mt-4 bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-slate-700">Sveukupno:</span>
            <span className="text-2xl font-bold text-blue-600">
              {totalAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
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
            disabled={loading}
          >
            {loading ? 'Spremanje...' : 'Kreiraj Račune'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
