import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, Form, Input } from '../../../ui'
import CurrencyInput from '../../../Common/CurrencyInput'
import DateInput from '../../../Common/DateInput'
import { useLandPurchaseFormData, Contract } from '../hooks/useLandPurchaseFormData'
import { createLandPurchaseInvoices, LandPurchaseFormData } from '../services/landPurchaseService'
import { checkDuplicateInvoiceNumber, isInvoiceNumberDuplicateError } from '../services/invoiceValidation'
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
  const { t } = useTranslation()
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
    if (!company_id) errors.company_id = t('invoices.land_purchase.error_company')
    if (!supplier_id) errors.supplier_id = t('invoices.land_purchase.error_supplier')
    if (!selectedContract) errors.contract_id = t('invoices.land_purchase.error_contract')
    if (!invoice_name.trim()) errors.invoice_name = t('invoices.land_purchase.error_invoice_name')

    if (selectedContract) {
      const totalAmount = deposit_amount + remaining_amount
      if (Math.abs(totalAmount - selectedContract.base_amount) > 0.01) {
        const mismatchMessage = `${t('invoices.land_purchase.amount_mismatch')} ${selectedContract.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €`
        errors.deposit_amount = mismatchMessage
        errors.remaining_amount = mismatchMessage
      }
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)

    try {
      const counterpartyColumn = projectType === 'retail' ? 'retail_supplier_id' : 'supplier_id'
      const depositNumber = `${invoice_name}-Kapara`
      const remainingNumber = `${invoice_name}-Preostalo`

      const [depositDup, remainingDup] = await Promise.all([
        deposit_amount > 0 ? checkDuplicateInvoiceNumber({
          companyId: company_id,
          counterpartyColumn,
          counterpartyId: supplier_id,
          invoiceNumber: depositNumber,
          issueDate: selectedContract!.contract_date,
        }) : Promise.resolve(false),
        remaining_amount > 0 ? checkDuplicateInvoiceNumber({
          companyId: company_id,
          counterpartyColumn,
          counterpartyId: supplier_id,
          invoiceNumber: remainingNumber,
          issueDate: selectedContract!.contract_date,
        }) : Promise.resolve(false),
      ])

      if (depositDup || remainingDup) {
        setFieldErrors({ invoice_name: t('invoices.form.error_invoice_number_duplicate') })
        setLoading(false)
        return
      }

      await createLandPurchaseInvoices(formData, projectType, selectedContract!)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error creating land purchase invoices:', error)
      if (isInvoiceNumberDuplicateError(error)) {
        setFieldErrors({ invoice_name: t('invoices.form.error_invoice_number_duplicate') })
      } else {
        toast.error(t('invoices.land_purchase.error_create'))
      }
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
      <Modal.Header title={t('invoices.land_purchase.title')} onClose={handleClose} />

      <Form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <Modal.Body>
        <div className="bg-slate-50 dark:bg-gray-800 p-5 rounded-lg mb-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-gray-100">{t('invoices.land_purchase.project_type')}</h3>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-1">
              <button
                type="button"
                onClick={() => setProjectType('projects')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  projectType === 'projects'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('invoices.land_purchase.projects')}
              </button>
              <button
                type="button"
                onClick={() => setProjectType('retail')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  projectType === 'retail'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Retail
              </button>
            </div>
          </div>

          <h3 className="text-base font-semibold text-slate-800 dark:text-gray-100 mb-4">{t('invoices.land_purchase.basic_info')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                {t('invoices.land_purchase.company_label')}
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="">{t('invoices.land_purchase.select_company')}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {fieldErrors.company_id && <p className="text-xs text-red-600 mt-1">{fieldErrors.company_id}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                {projectType === 'retail' ? t('invoices.land_purchase.retail_supplier_label') : t('invoices.land_purchase.supplier_label')}
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value, project_id: '', phase_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="">{projectType === 'retail' ? t('invoices.land_purchase.select_retail_supplier') : t('invoices.land_purchase.select_supplier')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {fieldErrors.supplier_id && <p className="text-xs text-red-600 mt-1">{fieldErrors.supplier_id}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                {projectType === 'retail' ? t('invoices.land_purchase.retail_project_label') : t('invoices.land_purchase.project_label')}
              </label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white disabled:bg-slate-100 dark:disabled:bg-gray-600"
                disabled={!formData.supplier_id}
              >
                <option value="">{projectType === 'retail' ? t('invoices.land_purchase.select_retail_project') : t('invoices.land_purchase.select_project')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                {t('invoices.land_purchase.phase_label')}
              </label>
              <select
                value={formData.phase_id}
                onChange={(e) => setFormData({ ...formData, phase_id: e.target.value, contract_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white disabled:bg-slate-100 dark:disabled:bg-gray-600"
                disabled={!formData.project_id}
              >
                <option value="">{t('invoices.land_purchase.select_phase')}</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.phase_name}
                  </option>
                ))}
              </select>
            </div>

            {availableContracts.length > 0 && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                  {t('invoices.land_purchase.contract_label')}
                </label>
                <select
                  value={formData.contract_id}
                  onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{t('invoices.land_purchase.select_contract')}</option>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                {t('invoices.land_purchase.iban_label')}
              </label>
              <Input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                placeholder="HR..."
              />
            </div>
          </div>

          {selectedContract && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-gray-400">{t('invoices.land_purchase.contract_number')}</span>
                  <span className="ml-2 font-semibold text-slate-800 dark:text-gray-100">{selectedContract.contract_number}</span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-gray-400">{t('invoices.land_purchase.contract_amount')}</span>
                  <span className="ml-2 font-semibold text-blue-700 dark:text-blue-300">
                    {selectedContract.base_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedContract && (
          <div className="bg-slate-50 dark:bg-gray-800 p-5 rounded-lg mb-5">
            <h3 className="text-base font-semibold text-slate-800 dark:text-gray-100 mb-4">{t('invoices.land_purchase.invoice_name_section')}</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                {t('invoices.land_purchase.invoice_name_label')}
              </label>
              <Input
                type="text"
                value={formData.invoice_name}
                onChange={(e) => setFormData({ ...formData, invoice_name: e.target.value })}
                placeholder={t('invoices.land_purchase.invoice_name_placeholder')}
              />
              {fieldErrors.invoice_name && <p className="text-xs text-red-600 mt-1">{fieldErrors.invoice_name}</p>}
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5">
                {t('invoices.land_purchase.invoice_name_hint')}<span className="font-semibold">{formData.invoice_name || t('invoices.land_purchase.invoice_name_default')}{t('invoices.land_purchase.invoice_name_deposit_suffix')}</span> i <span className="font-semibold">{formData.invoice_name || t('invoices.land_purchase.invoice_name_default')}{t('invoices.land_purchase.invoice_name_remaining_suffix')}</span>
              </p>
            </div>
          </div>
        )}

        {selectedContract && (
          <>
            <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg mb-5 border border-green-200 dark:border-green-800">
              <h3 className="text-base font-semibold text-green-900 dark:text-green-300 mb-4">{t('invoices.land_purchase.deposit_section')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                    {t('invoices.land_purchase.deposit_amount')}
                  </label>
                  <CurrencyInput
                    value={formData.deposit_amount}
                    onChange={(value) => setFormData({ ...formData, deposit_amount: value })}
                  />
                  {fieldErrors.deposit_amount && <p className="text-xs text-red-600 mt-1">{fieldErrors.deposit_amount}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                    {t('invoices.land_purchase.deposit_due_date')}
                  </label>
                  <DateInput
                    value={formData.deposit_due_date}
                    onChange={(value) => setFormData({ ...formData, deposit_due_date: value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-lg mb-5 border border-orange-200 dark:border-orange-800">
              <h3 className="text-base font-semibold text-orange-900 dark:text-orange-300 mb-4">{t('invoices.land_purchase.remaining_section')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                    {t('invoices.land_purchase.remaining_amount')}
                  </label>
                  <CurrencyInput
                    value={formData.remaining_amount}
                    onChange={(value) => setFormData({ ...formData, remaining_amount: value })}
                  />
                  {fieldErrors.remaining_amount && <p className="text-xs text-red-600 mt-1">{fieldErrors.remaining_amount}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                    {t('invoices.land_purchase.remaining_due_date')}
                  </label>
                  <DateInput
                    value={formData.remaining_due_date}
                    onChange={(value) => setFormData({ ...formData, remaining_due_date: value })}
                  />
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${amountMismatch ? 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-lg font-semibold text-slate-700 dark:text-gray-200">{t('invoices.land_purchase.grand_total')}</span>
                  {amountMismatch && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {t('invoices.land_purchase.amount_mismatch')} {contractAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
                    </p>
                  )}
                </div>
                <span className={`text-2xl font-bold ${amountMismatch ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-300'}`}>
                  {totalAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            </div>
          </>
        )}

        {formData.phase_id && availableContracts.length === 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-300">{t('invoices.land_purchase.no_contracts')}</p>
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
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={loading || !selectedContract || !!amountMismatch}
        >
          {loading ? t('invoices.land_purchase.save_loading') : t('invoices.land_purchase.create')}
        </Button>
      </Modal.Footer>
      </Form>
    </Modal>
  )
}
