import React from 'react'
import { X, Briefcase, FileText } from 'lucide-react'
import { SupplierSummary } from '../types/supplierTypes'

interface SupplierDetailsModalProps {
  showModal: boolean
  supplier: SupplierSummary | null
  onClose: () => void
}

const SupplierDetailsModal: React.FC<SupplierDetailsModalProps> = ({
  showModal,
  supplier,
  onClose
}) => {
  if (!showModal || !supplier) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{supplier.name}</h2>
              {supplier.source === 'retail' ? (
                <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">Retail</span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Site</span>
              )}
            </div>
            <p className="text-sm text-gray-600">{supplier.contact}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Ukupno ugovora</p>
              <p className="text-2xl font-bold text-gray-900">{supplier.total_contracts}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Vrijednost</p>
              <p className="text-2xl font-bold text-gray-900">€{supplier.total_contract_value.toLocaleString('hr-HR')}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700">Plaćeno</p>
              <p className="text-2xl font-bold text-green-900">€{supplier.total_paid.toLocaleString('hr-HR')}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-700">Dugovi</p>
              <p className="text-2xl font-bold text-orange-900">€{supplier.total_remaining.toLocaleString('hr-HR')}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Briefcase className="w-5 h-5 mr-2" />
              Ugovori ({supplier.contracts.length})
            </h3>
            {supplier.contracts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nema ugovora</p>
            ) : (
              <div className="space-y-3">
                {supplier.contracts.map((contract) => (
                  <div key={contract.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{contract.contract_number}</p>
                        <p className="text-sm text-gray-600">{contract.projects?.name || 'N/A'}</p>
                        {contract.phases?.phase_name && (
                          <p className="text-xs text-gray-500">{contract.phases.phase_name}</p>
                        )}
                        <p className="text-sm text-gray-600 mt-1">{contract.job_description}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        contract.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contract.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Ugovor</p>
                        <p className="text-sm font-medium">€{parseFloat(contract.contract_amount.toString()).toLocaleString('hr-HR')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Plaćeno</p>
                        <p className="text-sm font-medium text-green-600">€{(contract.actual_paid || 0).toLocaleString('hr-HR')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Preostalo</p>
                        <p className="text-sm font-medium text-orange-600">
                          €{(parseFloat(contract.contract_amount.toString()) - (contract.actual_paid || 0)).toLocaleString('hr-HR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Računi ({supplier.invoices.length})
            </h3>
            {supplier.invoices.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nema računa</p>
            ) : (
              <div className="space-y-3">
                {supplier.invoices.map((invoice) => (
                  <div key={invoice.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                        <p className="text-xs text-gray-500">{new Date(invoice.issue_date).toLocaleDateString('hr-HR')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {invoice.status === 'PAID' ? 'Plaćeno' :
                         invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Ukupno (bez PDV)</p>
                        <p className="text-sm font-medium">€{parseFloat((invoice.base_amount || 0).toString()).toLocaleString('hr-HR')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Plaćeno</p>
                        <p className="text-sm font-medium text-green-600">€{(invoice.actual_paid || 0).toLocaleString('hr-HR')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Preostalo</p>
                        <p className="text-sm font-medium text-orange-600">
                          €{Math.max(0, parseFloat((invoice.base_amount || 0).toString()) - (invoice.actual_paid || 0)).toLocaleString('hr-HR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  )
}

export default SupplierDetailsModal
