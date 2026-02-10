import React from 'react'
import { Briefcase, FileText } from 'lucide-react'
import { SupplierSummary } from '../types/supplierTypes'
import { Modal, Badge, Button, StatCard, StatGrid } from '../../ui'

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
  if (!supplier) return null

  return (
    <Modal show={showModal} onClose={onClose} size="xl">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0 rounded-t-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{supplier.name}</h2>
            {supplier.source === 'retail' ? (
              <Badge variant="teal" size="sm">Retail</Badge>
            ) : (
              <Badge variant="blue" size="sm">Site</Badge>
            )}
          </div>
          <p className="text-sm text-gray-600">{supplier.contact}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <span className="sr-only">Close</span>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <Modal.Body>
        <StatGrid columns={4}>
          <StatCard
            label="Ukupno ugovora"
            value={supplier.total_contracts}
            color="gray"
          />
          <StatCard
            label="Vrijednost"
            value={`€${supplier.total_contract_value.toLocaleString('hr-HR')}`}
            color="gray"
          />
          <StatCard
            label="Plaćeno"
            value={`€${supplier.total_paid.toLocaleString('hr-HR')}`}
            color="green"
          />
          <StatCard
            label="Dugovi"
            value={`€${supplier.total_remaining.toLocaleString('hr-HR')}`}
            color="yellow"
          />
        </StatGrid>

        <div>
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
                    <Badge variant={contract.status === 'active' ? 'green' : 'gray'} size="sm">
                      {contract.status}
                    </Badge>
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
                    <Badge
                      variant={
                        invoice.status === 'PAID' ? 'green' :
                        invoice.status === 'PARTIALLY_PAID' ? 'yellow' :
                        'red'
                      }
                      size="sm"
                    >
                      {invoice.status === 'PAID' ? 'Plaćeno' :
                       invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Ukupno (sa PDV)</p>
                      <p className="text-sm font-medium">€{parseFloat((invoice.total_amount || 0).toString()).toLocaleString('hr-HR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Plaćeno</p>
                      <p className="text-sm font-medium text-green-600">€{(invoice.actual_paid || 0).toLocaleString('hr-HR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Preostalo</p>
                      <p className="text-sm font-medium text-orange-600">
                        €{Math.max(0, parseFloat((invoice.total_amount || 0).toString()) - (invoice.actual_paid || 0)).toLocaleString('hr-HR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer sticky>
        <Button
          variant="ghost"
          onClick={onClose}
          className="bg-gray-600 text-white hover:bg-gray-700 hover:text-white"
        >
          Zatvori
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default SupplierDetailsModal
