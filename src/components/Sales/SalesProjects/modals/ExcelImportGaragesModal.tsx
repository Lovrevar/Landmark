import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from '@e965/xlsx'
import { Upload, CheckCircle } from 'lucide-react'
import { Modal, Button } from '../../../ui'
import { importGaragesFromExcel, fetchExistingGarageNumbers } from '../services/garageImportService'
import { useToast } from '../../../../contexts/ToastContext'
import { parseNumber } from '../../../../utils/excelParsers'
import { ImportOutcomeSummary } from './ImportOutcomeSummary'

interface ParsedGarageRow {
  rowIndex: number
  number: string
  size_m2: number
  price: number
  exists: boolean
}

interface ExcelImportGaragesModalProps {
  visible: boolean
  onClose: () => void
  selectedBuilding: { id: string; name: string } | null
  onComplete: () => void
}

export const ExcelImportGaragesModal: React.FC<ExcelImportGaragesModalProps> = ({
  visible,
  onClose,
  selectedBuilding,
  onComplete
}) => {
  const toast = useToast()
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedGarageRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{
    created: number
    updated: number
    failed: number
    errors: string[]
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const parseFile = async () => {
    if (!file || !selectedBuilding) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      const existingNumbers = await fetchExistingGarageNumbers(selectedBuilding.id)

      const parsed: ParsedGarageRow[] = rows
        .slice(1)
        .filter(row => row[0])
        .map((row, idx) => ({
          rowIndex: idx + 2,
          number: String(row[0]),
          // Same parser as importGaragesFromExcel, so the preview shows the values that will be
          // written: Number() reads a European "3.000,00" as NaN and previewed it as 0.
          size_m2: parseNumber(row[1]),
          price: parseNumber(row[2]),
          exists: existingNumbers.has(String(row[0]))
        }))

      setParsedRows(parsed)
      setStep(2)
    } catch (error) {
      console.error('Error parsing file:', error)
      toast.error(t('sales_projects.excel_import.parse_error'))
    }
  }

  const handleImport = async () => {
    if (!selectedBuilding || !file) return

    setImporting(true)
    try {
      const result = await importGaragesFromExcel(file, selectedBuilding.id)
      setImportResults({
        created: result.created,
        updated: result.updated,
        failed: result.errors.length,
        errors: result.errors.map(({ number, message }) =>
          t('sales_projects.excel_import.garage_error', { number, message })
        )
      })
      setStep(3)
    } catch (error) {
      console.error('Import error:', error)
      toast.error(t('sales_projects.excel_import.import_failed'))
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    // Escape, the backdrop and the header X all land here; closing mid-import would hide the result.
    if (importing) return
    if (importResults && (importResults.created > 0 || importResults.updated > 0)) {
      onComplete()
    }
    setFile(null)
    setParsedRows([])
    setStep(1)
    setImportResults(null)
    onClose()
  }

  if (!visible) return null

  return (
    <Modal show={visible} onClose={handleClose} size="lg">
      <Modal.Header
        title={t('sales_projects.excel_import.garages_title')}
        subtitle={selectedBuilding ? `${t('sales_projects.building')}: ${selectedBuilding.name}` : ''}
        onClose={handleClose}
      />

      <Modal.Body>
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('sales_projects.excel_import.upload_garages_file')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('sales_projects.excel_import.select_garages_file')}
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 dark:file:bg-orange-900/20 file:text-orange-700 dark:file:text-orange-400 hover:file:bg-orange-100 dark:hover:file:bg-orange-900/30"
              />
              {file && (
                <p className="mt-2 text-sm text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {file.name}
                </p>
              )}
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg p-4">
              <h4 className="font-medium text-orange-900 dark:text-orange-400 mb-2">{t('sales_projects.excel_import.expected_format')}</h4>
              {/* The bullets name literal Croatian spreadsheet columns (parking oznaka, parking m2,
                  parking cijena) and must stay verbatim; left in English pending a wording
                  decision, like the apartments modal. */}
              <ul className="text-sm text-orange-800 dark:text-orange-300 space-y-1 list-disc list-inside">
                <li>Header row on row 1</li>
                <li>Column 1: parking oznaka (garage number/label)</li>
                <li>Column 2: parking m2 (size in square meters)</li>
                <li>Column 3: parking cijena (price)</li>
              </ul>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{t('common.building')}:</strong> {selectedBuilding?.name}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                {t('sales_projects.excel_import.garages_note')}
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('sales_projects.excel_import.summary')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('sales_projects.excel_import.total_garages')}</span>
                  <span className="ml-2 font-medium">{parsedRows.length}</span>
                </div>
                <div>
                  <span className="text-green-600">{t('sales_projects.excel_import.new_count')}</span>
                  <span className="ml-2 font-medium text-green-600">
                    {parsedRows.filter(r => !r.exists).length}
                  </span>
                </div>
                <div>
                  <span className="text-yellow-600">{t('sales_projects.excel_import.update_existing')}</span>
                  <span className="ml-2 font-medium text-yellow-600">
                    {parsedRows.filter(r => r.exists).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('sales_projects.excel_import.row')}</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('sales_projects.excel_import.garage_number')}</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('apartments.table.size')} (m²)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('apartments.table.price')}</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.exists ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                      >
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{row.rowIndex}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-medium">{row.number}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{row.size_m2} m²</td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">€{row.price.toLocaleString('hr-HR')}</td>
                        <td className="px-4 py-2 text-sm">
                          {row.exists ? (
                            <span className="text-yellow-600 text-xs">{t('sales_projects.excel_import.will_update')}</span>
                          ) : (
                            <span className="text-green-600 text-xs">{t('sales_projects.excel_import.new_label')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 3 && importResults && (
          <div className="space-y-4">
            <ImportOutcomeSummary
              succeeded={importResults.created + importResults.updated}
              failed={importResults.failed}
              errors={importResults.errors}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">{t('sales_projects.excel_import.created')}</div>
                <div className="text-3xl font-bold text-green-700">{importResults.created}</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-600 mb-1">{t('sales_projects.excel_import.updated')}</div>
                <div className="text-3xl font-bold text-yellow-700">{importResults.updated}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-600 mb-1">{t('sales_projects.excel_import.failed')}</div>
                <div className="text-3xl font-bold text-red-700">{importResults.failed}</div>
              </div>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {step === 1 && (
          <>
            <Button variant="secondary" onClick={handleClose}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={parseFile}
              disabled={!file}
            >
              {t('sales_projects.excel_import.parse_file')}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={importing}>{t('common.back')}</Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={importing || parsedRows.length === 0}
            >
              {importing ? t('sales_projects.excel_import.importing') : t('sales_projects.excel_import.import_garages', { count: parsedRows.length })}
            </Button>
          </>
        )}

        {step === 3 && (
          <Button variant="primary" onClick={handleClose}>{t('common.close')}</Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
