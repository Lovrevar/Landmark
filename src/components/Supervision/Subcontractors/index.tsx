import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Plus } from 'lucide-react'
import { LoadingSpinner, PageHeader, Card, Modal, EmptyState, StatCard, SearchInput, Button, ConfirmDialog } from '../../ui'
import { formatEuropean } from '../../../utils/formatters'
import { useSubcontractorData } from './hooks/useSubcontractorData'
import { SubcontractorCard } from './SubcontractorCard'
import { SubcontractorContractsList } from './SubcontractorContractsList'
import { SubcontractorDocumentsSection } from './SubcontractorDocumentsSection'
import { SubcontractorBasicFormModal } from './forms/SubcontractorBasicFormModal'
import { ContractDocumentViewer } from '../SiteManagement/ContractDocumentViewer'
import { SubcontractorSummary, SubcontractorContract } from './types'
import { useToast } from '../../../contexts/ToastContext'

const SubcontractorManagement: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { subcontractors, loading, fetchData, deleteSubcontractor } = useSubcontractorData()
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
      await deleteSubcontractor(deleteConfirm.id)
      setDeleteConfirm({ show: false, id: '', name: '' })
      fetchData()
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
      toast.error(t('supervision.subcontractors.failed_delete'))
    }
  }

  const handleViewDocuments = (contract: SubcontractorContract) => {
    setViewingContractDocuments({
      subcontractorId: selectedSubcontractor!.id,
      contractId: contract.id,
      label: `${contract.project_name}${contract.phase_name ? ` · ${contract.phase_name}` : ''}`
    })
  }

  if (loading) return <LoadingSpinner message={t('supervision.subcontractors.loading')} />

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
        title={t('supervision.subcontractors.title')}
        description={t('supervision.subcontractors.subtitle')}
        actions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">{searchTerm ? t('supervision.subcontractors.showing') : t('supervision.subcontractors.total')} {t('common.subcontractors')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{displayCount}</p>
            </div>
            <Button onClick={() => { setEditingSubcontractor(null); setShowFormModal(true) }} icon={Plus}>
              {t('supervision.subcontractors.add')}
            </Button>
          </div>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('supervision.subcontractors.search_placeholder')}
        />
      </div>

      {subcontractorsList.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState icon={Users} title={t('supervision.subcontractors.none')} description={t('supervision.subcontractors.none_desc')} />
        </Card>
      ) : filteredSubcontractors.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState icon={Users} title={t('supervision.subcontractors.no_match')} description={t('supervision.subcontractors.no_match_desc')} />
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
                <StatCard label={t('supervision.subcontractors.total_contracts')} value={selectedSubcontractor.total_contracts} color="blue" />
                <StatCard label={t('supervision.subcontractors.contract_value')} value={`€${formatEuropean(selectedSubcontractor.total_contract_value)}`} color="gray" />
                <StatCard label={t('common.total_paid')} value={`€${formatEuropean(selectedSubcontractor.total_paid)}`} color="teal" />
                <StatCard label={t('common.remaining')} value={`€${formatEuropean(selectedSubcontractor.total_remaining)}`} color="yellow" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('supervision.subcontractors.all_contracts')}</h3>
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
              title={t('common.contract_documents')}
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
        title={t('supervision.subcontractors.delete_title')}
        message={t('supervision.subcontractors.delete_message')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: '', name: '' })}
      />
    </div>
  )
}

export default SubcontractorManagement
