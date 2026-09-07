import React, { useState } from 'react'
import { FileDown, FileSpreadsheet, Save, AlertCircle, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { exportToExcel, exportToPDF, type TICExportData } from './services/ticExport'
import { LoadingSpinner, Button, FormField, Select, Input, Alert, Card, EmptyState, Tabs } from '../../ui'
import { useTIC } from './hooks/useTIC'
import InvestmentTable from './components/InvestmentTable'
import ConstructionTable from './components/ConstructionTable'
import ExcelImportTICModal from './modals/ExcelImportTICModal'

type TICTab = 'investment' | 'construction'

const TICManagement: React.FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TICTab>('investment')
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState(false)

  const {
    projects,
    lineItems,
    constructionSections,
    investorName,
    setInvestorName,
    documentDate,
    setDocumentDate,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    saving,
    message,
    totals,
    grandTotal,
    constructionTotals,
    constructionGrandTotal,
    saveTIC,
    addLineItem,
    updateLineItem,
    removeLineItem,
    moveLineItem,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    addConstructionItem,
    updateConstructionItem,
    removeConstructionItem,
    moveConstructionItem,
    applyImport,
  } = useTIC()

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const exportData = (): TICExportData => ({
    lineItems,
    constructionSections,
    investorName,
    documentDate,
    totals,
    grandTotal,
    constructionTotals,
    constructionGrandTotal,
    projectName: selectedProject?.name,
  })

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      await exportToExcel(exportData())
    } catch (error) {
      console.error('Error exporting TIC to Excel:', error)
    } finally {
      setExporting(false)
    }
  }

  const constructionItemCount = constructionSections.reduce((sum, section) => sum + section.items.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tic.heading')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('tic.description')}</p>

          <FormField label={t('tic.select_project_label')} className="mt-4 max-w-md">
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loading}
            >
              <option value="">{t('tic.select_project_placeholder')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={saveTIC} disabled={!selectedProjectId} loading={saving} icon={Save}>
            {t('tic.save_button')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowImport(true)}
            disabled={!selectedProjectId}
            icon={Upload}
          >
            {t('tic.import_excel_button')}
          </Button>
          <Button
            variant="success"
            onClick={handleExportExcel}
            disabled={!selectedProjectId}
            loading={exporting}
            icon={FileSpreadsheet}
          >
            {t('tic.export_excel_button')}
          </Button>
          <Button
            variant="danger"
            onClick={() => exportToPDF(exportData())}
            disabled={!selectedProjectId}
            icon={FileDown}
          >
            {t('tic.export_pdf_button')}
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
          <LoadingSpinner message={t('tic.loading')} />
        </div>
      ) : !selectedProjectId ? (
        <EmptyState
          icon={AlertCircle}
          title={t('tic.no_project_title')}
          description={t('tic.no_project_description')}
        />
      ) : (
        <Card>
          <Tabs<TICTab>
            tabs={[
              { id: 'investment', label: t('tic.tab_investment'), count: lineItems.length },
              { id: 'construction', label: t('tic.tab_construction'), count: constructionItemCount },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="mb-6"
          />

          {activeTab === 'investment' ? (
            <InvestmentTable
              lineItems={lineItems}
              totals={totals}
              grandTotal={grandTotal}
              onUpdate={updateLineItem}
              onAdd={addLineItem}
              onRemove={removeLineItem}
              onMove={moveLineItem}
            />
          ) : (
            <ConstructionTable
              sections={constructionSections}
              totals={constructionTotals}
              grandTotal={constructionGrandTotal}
              onUpdateSection={updateSection}
              onAddSection={addSection}
              onRemoveSection={removeSection}
              onMoveSection={moveSection}
              onUpdateItem={updateConstructionItem}
              onAddItem={addConstructionItem}
              onRemoveItem={removeConstructionItem}
              onMoveItem={moveConstructionItem}
            />
          )}

          <div className="mt-8 space-y-4 max-w-xl">
            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                {t('tic.investor_label')}
              </label>
              <Input value={investorName} onChange={(e) => setInvestorName(e.target.value)} className="flex-1" />
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                {t('tic.for_investor_label')}
              </label>
              <div className="flex-1 border-b-2 border-gray-300 dark:border-gray-600 pb-2">
                <span className="text-gray-400 dark:text-gray-500 text-sm">{t('tic.signature_label')}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                {t('tic.date_label')}
              </label>
              <Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
            </div>
          </div>
        </Card>
      )}

      <ExcelImportTICModal
        show={showImport}
        onClose={() => setShowImport(false)}
        projectName={selectedProject?.name}
        onImport={applyImport}
      />
    </div>
  )
}

export default TICManagement
