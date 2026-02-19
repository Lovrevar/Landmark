import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Button, Modal } from '../../ui'
import CurrencyInput from '../../Common/CurrencyInput'
import DateInput from '../../Common/DateInput'

interface LandPurchaseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Company {
  id: string
  name: string
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
}

interface Contract {
  id: string
  contract_number: string
  contract_amount: number
  base_amount: number
  contract_date: string
}

export const LandPurchaseFormModal: React.FC<LandPurchaseFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false)
  const [projectType, setProjectType] = useState<'projects' | 'retail'>('projects')
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [availableContracts, setAvailableContracts] = useState<Contract[]>([])
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    if (isOpen) {
      fetchCompanies()
      fetchSuppliersWithContracts()
    }
  }, [isOpen, projectType])

  useEffect(() => {
    setFormData({
      company_id: formData.company_id,
      supplier_id: '',
      project_id: '',
      phase_id: '',
      contract_id: '',
      invoice_name: '',
      iban: formData.iban,
      deposit_amount: 0,
      deposit_due_date: new Date().toISOString().split('T')[0],
      remaining_amount: 0,
      remaining_due_date: new Date().toISOString().split('T')[0]
    })
    setProjects([])
    setPhases([])
    setSuppliers([])
    setAvailableContracts([])
    setSelectedContract(null)
    if (isOpen) {
      fetchSuppliersWithContracts()
    }
  }, [projectType])

  useEffect(() => {
    if (formData.supplier_id) {
      fetchProjectsForSupplier(formData.supplier_id)
    } else {
      setProjects([])
      setFormData(prev => ({ ...prev, project_id: '', phase_id: '', contract_id: '' }))
    }
  }, [formData.supplier_id])

  useEffect(() => {
    if (formData.project_id && formData.supplier_id) {
      fetchPhasesForSupplierAndProject(formData.supplier_id, formData.project_id)
    } else {
      setPhases([])
      setFormData(prev => ({ ...prev, phase_id: '', contract_id: '' }))
    }
  }, [formData.project_id])

  useEffect(() => {
    if (formData.phase_id && formData.supplier_id && formData.project_id) {
      fetchContracts()
    } else {
      setAvailableContracts([])
      setSelectedContract(null)
      setFormData(prev => ({ ...prev, contract_id: '', deposit_amount: 0, remaining_amount: 0 }))
    }
  }, [formData.phase_id])

  useEffect(() => {
    if (formData.contract_id) {
      const contract = availableContracts.find(c => c.id === formData.contract_id)
      setSelectedContract(contract || null)
    } else {
      setSelectedContract(null)
      setFormData(prev => ({ ...prev, deposit_amount: 0, remaining_amount: 0 }))
    }
  }, [formData.contract_id, availableContracts])

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('accounting_companies')
      .select('id, name')
      .order('name')

    if (data) setCompanies(data)
  }

  const fetchSuppliersWithContracts = async () => {
    if (projectType === 'projects') {
      const { data } = await supabase
        .from('subcontractors')
        .select(`
          id,
          name,
          contracts!inner(id)
        `)
        .order('name')

      if (data) {
        const uniqueSuppliers = data.map(s => ({ id: s.id, name: s.name }))
        setSuppliers(uniqueSuppliers)
      }
    } else {
      const { data } = await supabase
        .from('retail_suppliers')
        .select(`
          id,
          name,
          retail_contracts!inner(id)
        `)
        .order('name')

      if (data) {
        const uniqueSuppliers = data.map(s => ({ id: s.id, name: s.name }))
        setSuppliers(uniqueSuppliers)
      }
    }
  }

  const fetchProjectsForSupplier = async (supplierId: string) => {
    if (projectType === 'projects') {
      const { data } = await supabase
        .from('contracts')
        .select('project_id, projects(id, name)')
        .eq('subcontractor_id', supplierId)

      if (data) {
        const uniqueProjects = Array.from(
          new Map(
            data
              .filter(c => c.projects)
              .map(c => [c.projects!.id, { id: c.projects!.id, name: c.projects!.name }])
          ).values()
        )
        setProjects(uniqueProjects as Project[])
      }
    } else {
      const { data } = await supabase
        .from('retail_contracts')
        .select('phase_id, retail_project_phases!inner(project_id, retail_projects(id, name))')
        .eq('supplier_id', supplierId)

      if (data) {
        const uniqueProjects = Array.from(
          new Map(
            data
              .filter(c => c.retail_project_phases?.retail_projects)
              .map(c => [
                c.retail_project_phases!.retail_projects!.id,
                {
                  id: c.retail_project_phases!.retail_projects!.id,
                  name: c.retail_project_phases!.retail_projects!.name
                }
              ])
          ).values()
        )
        setProjects(uniqueProjects as Project[])
      }
    }
  }

  const fetchPhasesForSupplierAndProject = async (supplierId: string, projectId: string) => {
    if (projectType === 'projects') {
      const { data } = await supabase
        .from('contracts')
        .select('phase_id, project_phases(id, phase_name)')
        .eq('subcontractor_id', supplierId)
        .eq('project_id', projectId)

      if (data) {
        const uniquePhases = Array.from(
          new Map(
            data
              .filter(c => c.project_phases)
              .map(c => [c.project_phases!.id, { id: c.project_phases!.id, phase_name: c.project_phases!.phase_name }])
          ).values()
        )
        setPhases(uniquePhases as Phase[])
      }
    } else {
      const { data } = await supabase
        .from('retail_contracts')
        .select('phase_id, retail_project_phases!inner(id, phase_name, project_id)')
        .eq('supplier_id', supplierId)

      if (data) {
        const filteredPhases = data.filter(c =>
          c.retail_project_phases &&
          c.retail_project_phases.project_id === projectId
        )

        const uniquePhases = Array.from(
          new Map(
            filteredPhases
              .map(c => [c.retail_project_phases!.id, { id: c.retail_project_phases!.id, phase_name: c.retail_project_phases!.phase_name }])
          ).values()
        )
        setPhases(uniquePhases as Phase[])
      }
    }
  }

  const fetchContracts = async () => {
    if (projectType === 'projects') {
      const { data } = await supabase
        .from('contracts')
        .select('id, contract_number, contract_amount, base_amount, start_date')
        .eq('subcontractor_id', formData.supplier_id)
        .eq('project_id', formData.project_id)
        .eq('phase_id', formData.phase_id)
        .gt('base_amount', 0)
        .order('start_date', { ascending: false })

      if (data) {
        const contracts = data.map(c => ({
          id: c.id,
          contract_number: c.contract_number,
          contract_amount: c.contract_amount,
          base_amount: c.base_amount,
          contract_date: c.start_date || new Date().toISOString().split('T')[0]
        }))
        setAvailableContracts(contracts)
      } else {
        setAvailableContracts([])
      }
    } else {
      const { data } = await supabase
        .from('retail_contracts')
        .select('id, contract_number, contract_amount, contract_date, retail_project_phases!inner(project_id)')
        .eq('supplier_id', formData.supplier_id)
        .eq('phase_id', formData.phase_id)
        .eq('retail_project_phases.project_id', formData.project_id)
        .gt('contract_amount', 0)
        .order('contract_date', { ascending: false })

      if (data) {
        const contracts = data.map(c => ({
          id: c.id,
          contract_number: c.contract_number,
          contract_amount: c.contract_amount,
          base_amount: c.contract_amount,
          contract_date: c.contract_date || new Date().toISOString().split('T')[0]
        }))
        setAvailableContracts(contracts)
      } else {
        setAvailableContracts([])
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { company_id, supplier_id, invoice_name, deposit_amount, deposit_due_date, remaining_amount, remaining_due_date, iban } = formData

      if (!company_id || !supplier_id || !selectedContract || !invoice_name) {
        alert('Molimo popunite sva obavezna polja')
        setLoading(false)
        return
      }

      const totalAmount = deposit_amount + remaining_amount
      if (Math.abs(totalAmount - selectedContract.base_amount) > 0.01) {
        alert(`Zbir kapare i preostalog iznosa (${totalAmount.toFixed(2)} €) mora biti jednak iznosu iz ugovora (${selectedContract.base_amount.toFixed(2)} €)`)
        setLoading(false)
        return
      }

      const invoicesToCreate = []

      if (projectType === 'projects') {
        if (deposit_amount > 0) {
          invoicesToCreate.push({
            invoice_number: `${invoice_name}-Kapara`,
            invoice_type: 'INCOMING_SUPPLIER',
            invoice_category: 'SUBCONTRACTOR',
            company_id: company_id,
            supplier_id: supplier_id,
            contract_id: selectedContract.id,
            project_id: formData.project_id,
            issue_date: selectedContract.contract_date,
            due_date: deposit_due_date,
            base_amount: deposit_amount,
            vat_rate: 0,
            vat_amount: 0,
            total_amount: deposit_amount,
            category: 'land_purchase',
            description: 'Kapara za kupoprodaju zemljišta',
            status: 'UNPAID',
            paid_amount: 0,
            remaining_amount: deposit_amount,
            base_amount_1: 0,
            vat_rate_1: 25,
            vat_amount_1: 0,
            base_amount_2: 0,
            vat_rate_2: 13,
            vat_amount_2: 0,
            base_amount_3: deposit_amount,
            vat_rate_3: 0,
            vat_amount_3: 0,
            approved: false,
            iban: iban || null
          })
        }

        if (remaining_amount > 0) {
          invoicesToCreate.push({
            invoice_number: `${invoice_name}-Preostalo`,
            invoice_type: 'INCOMING_SUPPLIER',
            invoice_category: 'SUBCONTRACTOR',
            company_id: company_id,
            supplier_id: supplier_id,
            contract_id: selectedContract.id,
            project_id: formData.project_id,
            issue_date: selectedContract.contract_date,
            due_date: remaining_due_date,
            base_amount: remaining_amount,
            vat_rate: 0,
            vat_amount: 0,
            total_amount: remaining_amount,
            category: 'land_purchase',
            description: 'Preostali iznos za kupoprodaju zemljišta',
            status: 'UNPAID',
            paid_amount: 0,
            remaining_amount: remaining_amount,
            base_amount_1: 0,
            vat_rate_1: 25,
            vat_amount_1: 0,
            base_amount_2: 0,
            vat_rate_2: 13,
            vat_amount_2: 0,
            base_amount_3: remaining_amount,
            vat_rate_3: 0,
            vat_amount_3: 0,
            approved: false,
            iban: iban || null
          })
        }
      } else {
        if (deposit_amount > 0) {
          invoicesToCreate.push({
            invoice_number: `${invoice_name}-Kapara`,
            invoice_type: 'INCOMING_SUPPLIER',
            invoice_category: 'RETAIL',
            company_id: company_id,
            retail_supplier_id: supplier_id,
            retail_contract_id: selectedContract.id,
            retail_project_id: formData.project_id,
            issue_date: selectedContract.contract_date,
            due_date: deposit_due_date,
            base_amount: deposit_amount,
            vat_rate: 0,
            vat_amount: 0,
            total_amount: deposit_amount,
            category: 'land_purchase',
            description: 'Kapara za kupoprodaju zemljišta',
            status: 'UNPAID',
            paid_amount: 0,
            remaining_amount: deposit_amount,
            base_amount_1: 0,
            vat_rate_1: 25,
            vat_amount_1: 0,
            base_amount_2: 0,
            vat_rate_2: 13,
            vat_amount_2: 0,
            base_amount_3: deposit_amount,
            vat_rate_3: 0,
            vat_amount_3: 0,
            approved: false,
            iban: iban || null
          })
        }

        if (remaining_amount > 0) {
          invoicesToCreate.push({
            invoice_number: `${invoice_name}-Preostalo`,
            invoice_type: 'INCOMING_SUPPLIER',
            invoice_category: 'RETAIL',
            company_id: company_id,
            retail_supplier_id: supplier_id,
            retail_contract_id: selectedContract.id,
            retail_project_id: formData.project_id,
            issue_date: selectedContract.contract_date,
            due_date: remaining_due_date,
            base_amount: remaining_amount,
            vat_rate: 0,
            vat_amount: 0,
            total_amount: remaining_amount,
            category: 'land_purchase',
            description: 'Preostali iznos za kupoprodaju zemljišta',
            status: 'UNPAID',
            paid_amount: 0,
            remaining_amount: remaining_amount,
            base_amount_1: 0,
            vat_rate_1: 25,
            vat_amount_1: 0,
            base_amount_2: 0,
            vat_rate_2: 13,
            vat_amount_2: 0,
            base_amount_3: remaining_amount,
            vat_rate_3: 0,
            vat_amount_3: 0,
            approved: false,
            iban: iban || null
          })
        }
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
    setAvailableContracts([])
    setProjectType('projects')
    setSuppliers([])
    setProjects([])
    setPhases([])
    onClose()
  }

  const totalAmount = formData.deposit_amount + formData.remaining_amount
  const contractAmount = selectedContract?.base_amount || 0
  const amountMismatch = selectedContract && Math.abs(totalAmount - contractAmount) > 0.01

  return (
    <Modal show={isOpen} onClose={handleClose} size="xl">
      <Modal.Header title="Kupoprodaja Zemljišta" onClose={handleClose} />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
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
                required
              >
                <option value="">Odaberite firmu</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {projectType === 'retail' ? 'Retail Dobavljač *' : 'Dobavljač *'}
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value, project_id: '', phase_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                required
              >
                <option value="">Odaberite {projectType === 'retail' ? 'retail dobavljača' : 'dobavljača'}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {projectType === 'retail' ? 'Retail Projekt *' : 'Projekt *'}
              </label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-slate-100"
                required
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

            {availableContracts.length > 0 && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ugovor *
                </label>
                <select
                  value={formData.contract_id}
                  onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  required
                >
                  <option value="">Odaberite ugovor</option>
                  {availableContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_number} - {contract.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
                    </option>
                  ))}
                </select>
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
                required
              />
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
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Datum Dospijeća *
                  </label>
                  <DateInput
                    value={formData.deposit_due_date}
                    onChange={(value) => setFormData({ ...formData, deposit_due_date: value })}
                    required
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
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Datum Dospijeća *
                  </label>
                  <DateInput
                    value={formData.remaining_due_date}
                    onChange={(value) => setFormData({ ...formData, remaining_due_date: value })}
                    required
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
          disabled={loading || !selectedContract || amountMismatch}
        >
          {loading ? 'Spremanje...' : 'Kreiraj Račune'}
        </Button>
      </Modal.Footer>
      </form>
    </Modal>
  )
}
