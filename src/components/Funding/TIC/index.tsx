import React from 'react'
import { FileDown, FileSpreadsheet, Save, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { exportToExcel, exportToPDF } from './services/ticExport'
import { LoadingSpinner, Button, FormField, Select, Input, Alert, Card, EmptyState } from '../../ui'
import { useTIC } from './hooks/useTIC'
import { formatNumber, formatPercentage, calculateRowPercentages } from './utils/ticFormatters'

const TICManagement: React.FC = () => {
  const { t } = useTranslation()
  const {
    projects,
    lineItems,
    setLineItems,
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
    saveTIC
  } = useTIC()

  const handleValueChange = (index: number, field: 'vlastita' | 'kreditna', value: string) => {
    const numValue = parseFloat(value) || 0
    const newItems = [...lineItems]
    newItems[index] = { ...newItems[index], [field]: numValue }
    setLineItems(newItems)
  }

  const handleExportExcel = () => {
    const selectedProject = projects.find(p => p.id === selectedProjectId)
    exportToExcel(lineItems, investorName, documentDate, totals, grandTotal, selectedProject?.name)
  }

  const handleExportPDF = () => {
    const selectedProject = projects.find(p => p.id === selectedProjectId)
    exportToPDF(lineItems, investorName, documentDate, totals, grandTotal, selectedProject?.name)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{t('tic.heading')}</h2>
          <p className="text-gray-600 mt-1">{t('tic.description')}</p>

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

        <div className="flex gap-3">
          <Button
            onClick={saveTIC}
            disabled={!selectedProjectId}
            loading={saving}
            icon={Save}
          >
            {t('tic.save_button')}
          </Button>
          <Button
            variant="success"
            onClick={handleExportExcel}
            disabled={!selectedProjectId}
            icon={FileSpreadsheet}
          >
            {t('tic.export_excel_button')}
          </Button>
          <Button
            variant="danger"
            onClick={handleExportPDF}
            disabled={!selectedProjectId}
            icon={FileDown}
          >
            {t('tic.export_pdf_button')}
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Alert>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
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
          <h3 className="text-lg font-bold text-center text-gray-900 mb-6 uppercase">
            {t('tic.table_heading')}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900">
                    {t('tic.col_purpose')}
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900" colSpan={2}>
                    {t('tic.col_own_funds')}
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900" colSpan={2}>
                    {t('tic.col_credit_funds')}
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">
                    {t('tic.col_total_investment')}
                  </th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2"></th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    EUR
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    (%)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    EUR
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    (%)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                    EUR
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => {
                  const rowTotal = item.vlastita + item.kreditna
                  const vlastitaPercent = calculateRowPercentages(item.vlastita, grandTotal)
                  const kreditnaPercent = calculateRowPercentages(item.kreditna, grandTotal)

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-gray-900">{item.name}</td>
                      <td className="border border-gray-300 px-2 py-2">
                        <Input
                          type="number"
                          value={item.vlastita}
                          onChange={(e) => handleValueChange(index, 'vlastita', e.target.value)}
                          className="px-2 py-1 text-right border-gray-200"
                          step="0.01"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {formatPercentage(vlastitaPercent)}%
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <Input
                          type="number"
                          value={item.kreditna}
                          onChange={(e) => handleValueChange(index, 'kreditna', e.target.value)}
                          className="px-2 py-1 text-right border-gray-200"
                          step="0.01"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {formatPercentage(kreditnaPercent)}%
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-900">
                        {formatNumber(rowTotal)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-blue-50 font-bold">
                  <td className="border border-gray-300 px-4 py-3 text-gray-900 uppercase">{t('tic.total_row')}</td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatNumber(totals.vlastita)}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatPercentage(calculateRowPercentages(totals.vlastita, grandTotal))}%
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatNumber(totals.kreditna)}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatPercentage(calculateRowPercentages(totals.kreditna, grandTotal))}%
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-right text-blue-900">
                    {formatNumber(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 space-y-4 max-w-xl">
            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">{t('tic.investor_label')}</label>
              <Input
                value={investorName}
                onChange={(e) => setInvestorName(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">{t('tic.for_investor_label')}</label>
              <div className="flex-1 border-b-2 border-gray-300 pb-2">
                <span className="text-gray-400 text-sm">{t('tic.signature_label')}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">{t('tic.date_label')}</label>
              <Input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default TICManagement
