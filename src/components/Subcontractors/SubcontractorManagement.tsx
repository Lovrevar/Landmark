import React, { useState, useEffect } from 'react'
import { Users, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner, PageHeader, Card, Modal, EmptyState, StatCard, SearchInput, Button, ConfirmDialog } from '../ui'
import { formatEuropean } from '../../utils/formatters'
import { useSubcontractorData } from './hooks/useSubcontractorData'
import { SubcontractorCard } from './views/SubcontractorCard'
import { SubcontractorContractsList } from './views/SubcontractorContractsList'
import { SubcontractorDocumentsSection } from './views/SubcontractorDocumentsSection'
import { SubcontractorBasicFormModal } from './forms/SubcontractorBasicFormModal'
import { ContractDocumentViewer } from '../Site/components/ContractDocumentViewer'
import { SubcontractorSummary, SubcontractorContract } from './types'

const SubcontractorManagement: React.FC = () => {
  const { subcontractors, loading, fetchData } = useSubcontractorData()
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<SubcontractorSummary | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<{ id: string; name: string; contact: string; notes?: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({ show: false, id: '', name: '' })
  const [viewingContractDocuments, setViewingContractDocuments] = useState<{ subcontractorId: string; contractId: string; label: string } | null>(null)

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    document.body.style.overflow = selectedSubcontractor ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [selectedSubcontractor])

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('subcontractors').delete().eq('id', deleteConfirm.id)
      if (error) throw error
      setDeleteConfirm({ show: false, id: '', name: '' })
      fetchData()
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
      alert('Failed to delete subcontractor. Check if there are contracts associated with it.')
    }
  }

  const handleViewDocuments = (contract: SubcontractorContract) => {
    setViewingContractDocuments({
      subcontractorId: selectedSubcontractor!.id,
      contractId: contract.id,
      label: `${contract.project_name}${contract.phase_name ? ` · ${contract.phase_name}` : ''}`
    })
  }

  if (loading) return <LoadingSpinner message="Loading subcontractors..." />

  const subcontractorsList = Array.from(subcontractors.values())
  const filteredSubcontractors = subcontractorsList.filter(sub =>
    sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.contact.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const displayCount = searchTerm
    ? `${filteredSubcontractors.length} / ${subcontractorsList.length}`
    : subcontractorsList.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subcontractors"
        description="Overview of all subcontractors and their contracts"
        actions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">{searchTerm ? 'Showing' : 'Total'} Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900">{displayCount}</p>
            </div>
            <Button onClick={() => { setEditingSubcontractor(null); setShowFormModal(true) }} icon={Plus}>
              Add Subcontractor
            </Button>
          </div>
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Search by subcontractor name or contact..."
        />
      </div>

      {subcontractorsList.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState icon={Users} title="No Subcontractors Yet" description="Add subcontractors from Site Management" />
        </Card>
      ) : filteredSubcontractors.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState icon={Users} title="No Matching Subcontractors" description="Try adjusting your search criteria" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSubcontractors.map((sub) => (
            <SubcontractorCard
              key={sub.id}
              sub={sub}
              onSelect={() => setSelectedSubcontractor(sub)}
              onEdit={(e) => { e.stopPropagation(); setEditingSubcontractor({ id: sub.id, name: sub.name, contact: sub.contact, notes: sub.notes }); setShowFormModal(true) }}
              onDelete={(e) => { e.stopPropagation(); setDeleteConfirm({ show: true, id: sub.id, name: sub.name }) }}
            />
          ))}
        </div>
      )}

      <SubcontractorBasicFormModal
        visible={showFormModal}
        onClose={() => setShowFormModal(false)}
        editingId={editingSubcontractor?.id ?? null}
        initialData={{ name: editingSubcontractor?.name ?? '', contact: editingSubcontractor?.contact ?? '', notes: editingSubcontractor?.notes ?? '' }}
        onSaved={fetchData}
      />

      <Modal show={!!selectedSubcontractor} onClose={() => setSelectedSubcontractor(null)} size="xl">
        {selectedSubcontractor && (
          <>
            <Modal.Header
              title={selectedSubcontractor.name}
              subtitle={selectedSubcontractor.contact}
              onClose={() => setSelectedSubcontractor(null)}
            />
            <Modal.Body>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Contracts" value={selectedSubcontractor.total_contracts} color="blue" />
                <StatCard label="Contract Value" value={`€${formatEuropean(selectedSubcontractor.total_contract_value)}`} color="gray" />
                <StatCard label="Total Paid" value={`€${formatEuropean(selectedSubcontractor.total_paid)}`} color="teal" />
                <StatCard label="Remaining" value={`€${formatEuropean(selectedSubcontractor.total_remaining)}`} color="yellow" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Contracts</h3>
              <SubcontractorContractsList
                contracts={selectedSubcontractor.contracts}
                onViewDocuments={handleViewDocuments}
              />

              <SubcontractorDocumentsSection subcontractorId={selectedSubcontractor.id} />
            </Modal.Body>
          </>
        )}
      </Modal>

      <Modal show={!!viewingContractDocuments} onClose={() => setViewingContractDocuments(null)} size="md">
        {viewingContractDocuments && (
          <>
            <Modal.Header
              title="Dokumenti ugovora"
              subtitle={viewingContractDocuments.label}
              onClose={() => setViewingContractDocuments(null)}
            />
            <Modal.Body>
              <ContractDocumentViewer
                subcontractorId={viewingContractDocuments.subcontractorId}
                contractId={viewingContractDocuments.contractId}
                readOnly
              />
            </Modal.Body>
          </>
        )}
      </Modal>

      <ConfirmDialog
        show={deleteConfirm.show}
        title="Delete Subcontractor"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: '', name: '' })}
      />
    </div>
  )
}

export default SubcontractorManagement
