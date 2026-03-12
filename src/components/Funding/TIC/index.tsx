import React from 'react'
import { FileDown, FileSpreadsheet, Save, AlertCircle } from 'lucide-react'
import { exportToExcel, exportToPDF } from './Services/TICExport'
import { LoadingSpinner, Button, FormField, Select, Input, Alert, Card, EmptyState } from '../../ui'
import { useTIC } from './hooks/useTIC'
import { formatNumber, formatPercentage, calculateRowPercentages } from './utils/ticFormatters'

const TICManagement: React.FC = () => {
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
          <h2 className="text-2xl font-bold text-gray-900">TIC - Struktura Troškova Investicije</h2>
          <p className="text-gray-600 mt-1">Kalkulator troškova investicije (bez PDV-a)</p>

          <FormField label="Odaberi projekt:" className="mt-4 max-w-md">
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loading}
            >
              <option value="">-- Odaberi projekt --</option>
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
            Spremi
          </Button>
          <Button
            variant="success"
            onClick={handleExportExcel}
            disabled={!selectedProjectId}
            icon={FileSpreadsheet}
          >
            Export Excel
          </Button>
          <Button
            variant="danger"
            onClick={handleExportPDF}
            disabled={!selectedProjectId}
            icon={FileDown}
          >
            Export PDF
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
          <LoadingSpinner message="Učitavam TIC podatke..." />
        </div>
      ) : !selectedProjectId ? (
        <EmptyState
          icon={AlertCircle}
          title="Nema odabranog projekta"
          description="Odaberite projekt za pregled TIC strukture troškova"
        />
      ) : (
        <Card>
          <h3 className="text-lg font-bold text-center text-gray-900 mb-6 uppercase">
            Struktura Troškova Investicije (bez PDV-a)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900">
                    NAMJENA
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900" colSpan={2}>
                    VLASTITA SREDSTVA
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900" colSpan={2}>
                    KREDITNA SREDSTVA
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">
                    UKUPNA INVESTICIJA
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
                        <input
                          type="number"
                          value={item.vlastita}
                          onChange={(e) => handleValueChange(index, 'vlastita', e.target.value)}
                          className="w-full px-2 py-1 text-right border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          step="0.01"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {formatPercentage(vlastitaPercent)}%
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="number"
                          value={item.kreditna}
                          onChange={(e) => handleValueChange(index, 'kreditna', e.target.value)}
                          className="w-full px-2 py-1 text-right border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <td className="border border-gray-300 px-4 py-3 text-gray-900 uppercase">UKUPNO:</td>
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
              <label className="font-semibold text-gray-900 whitespace-nowrap">INVESTITOR:</label>
              <Input
                value={investorName}
                onChange={(e) => setInvestorName(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">Za investitora:</label>
              <div className="flex-1 border-b-2 border-gray-300 pb-2">
                <span className="text-gray-400 text-sm">Potpis</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="font-semibold text-gray-900 whitespace-nowrap">Datum:</label>
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
