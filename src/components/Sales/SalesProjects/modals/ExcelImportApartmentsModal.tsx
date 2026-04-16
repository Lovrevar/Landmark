import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from '@e965/xlsx'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Modal, Button } from '../../../ui'
import { parseNumber, parseDate, detectPaymentType } from '../../../../utils/excelParsers'
import { importApartmentRow } from '../services/apartmentImportService'
import { useToast } from '../../../../contexts/ToastContext'

interface ParsedApartmentRow {
  rowIndex: number
  building_label: string
  entrance: string
  floor: number
  number: string
  type: string
  rooms: string
  area_closed: number
  area_open: number
  area_open_coef: number
  size_m2: number
  price_per_m2: number
  price: number
  parking_label: string | null
  parking_m2: number | null
  parking_price: number | null
  storage_label: string | null
  storage_m2: number | null
  storage_price: number | null
  total_price: number
  datum_potpisa_predugovora: string | null
  contract_payment_type: 'credit' | 'installments' | null
  kapara_10_posto: number | null
  rata_1_ab_konstrukcija_30: number | null
  rata_2_postava_stolarije_20: number | null
  rata_3_obrtnicki_radovi_20: number | null
  rata_4_uporabna_20: number | null
  kredit_etaziranje_90: number | null
  errors: string[]
  building_id?: string
}

interface ExcelImportApartmentsModalProps {
  visible: boolean
  onClose: () => void
  selectedProject: { id: string; name?: string; buildings?: { id: string; name: string }[] } | null
  onComplete: () => void
}

export const ExcelImportApartmentsModal: React.FC<ExcelImportApartmentsModalProps> = ({
  visible,
  onClose,
  selectedProject,
  onComplete
}) => {
  const toast = useToast()
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedApartmentRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{
    success: number
    failed: number
    garagesCreated: number
    storagesCreated: number
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const parseFile = async () => {
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      const dataRows = rows.slice(1).filter(row => row[3])

      const buildingsMap = new Map()
      selectedProject?.buildings?.forEach((b: { id: string; name: string }) => {
        buildingsMap.set(b.name.toLowerCase().trim(), b.id)
      })

      const parsed: ParsedApartmentRow[] = dataRows.map((row, idx) => {
        const errors: string[] = []
        const buildingLabel = String(row[0] || '').trim()
        const apartmentNumber = String(row[3] || '').trim()
        const sizeM2 = parseNumber(row[9])
        const price = parseNumber(row[11])

        if (!apartmentNumber) errors.push('Missing apartment number')
        if (!sizeM2) errors.push('Missing size (m2)')
        if (!price) errors.push('Missing price')

        const building_id = buildingsMap.get(buildingLabel.toLowerCase())
        if (!building_id && buildingLabel) {
          errors.push(`Building '${buildingLabel}' not found`)
        }

        return {
          rowIndex: idx + 2,
          building_label: buildingLabel,
          entrance: row[1] || '',
          floor: parseNumber(row[2]),
          number: apartmentNumber,
          type: row[4] || '',
          rooms: row[5] || '',
          area_closed: parseNumber(row[6]),
          area_open: parseNumber(row[7]),
          area_open_coef: parseNumber(row[8]),
          size_m2: sizeM2,
          price_per_m2: parseNumber(row[10]),
          price: price,
          parking_label: row[12] || null,
          parking_m2: row[13] ? parseNumber(row[13]) : null,
          parking_price: row[14] ? parseNumber(row[14]) : null,
          storage_label: row[15] || null,
          storage_m2: row[16] ? parseNumber(row[16]) : null,
          storage_price: row[17] ? parseNumber(row[17]) : null,
          total_price: parseNumber(row[18]),
          datum_potpisa_predugovora: parseDate(row[19]),
          contract_payment_type: detectPaymentType(row),
          kapara_10_posto: row[20] ? parseNumber(row[20]) : null,
          rata_1_ab_konstrukcija_30: row[21] ? parseNumber(row[21]) : null,
          rata_2_postava_stolarije_20: row[22] ? parseNumber(row[22]) : null,
          rata_3_obrtnicki_radovi_20: row[23] ? parseNumber(row[23]) : null,
          rata_4_uporabna_20: row[24] ? parseNumber(row[24]) : null,
          kredit_etaziranje_90: row[25] ? parseNumber(row[25]) : null,
          errors,
          building_id
        }
      })

      setParsedRows(parsed)
      setStep(2)
    } catch (error) {
      console.error('Error parsing file:', error)
      toast.error('Error parsing Excel file. Please check the file format.')
    }
  }

  const handleImport = async () => {
    if (!selectedProject) return
    setImporting(true)
    let successCount = 0
    let failedCount = 0
    let garagesCreated = 0
    let storagesCreated = 0

    try {
      for (const row of parsedRows) {
        if (row.errors.length > 0 || !row.building_id) {
          failedCount++
          continue
        }

        try {
          const result = await importApartmentRow(row as Parameters<typeof importApartmentRow>[0], selectedProject.id)
          if (result.garageCreated) garagesCreated++
          if (result.storageCreated) storagesCreated++
          successCount++
        } catch (error) {
          console.error(`Error importing row ${row.rowIndex}:`, error)
          failedCount++
        }
      }

      setImportResults({ success: successCount, failed: failedCount, garagesCreated, storagesCreated })
      setStep(3)
    } catch (error) {
      console.error('Import error:', error)
      toast.error('An error occurred during import. Please check the console.')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    if (importResults && importResults.success > 0) {
      onComplete()
    }
    setFile(null)
    setParsedRows([])
    setStep(1)
    setImportResults(null)
    onClose()
  }

  if (!visible) return null

  const validRows = parsedRows.filter(r => r.errors.length === 0 && r.building_id)
  const invalidRows = parsedRows.filter(r => r.errors.length > 0 || !r.building_id)

  return (
    <Modal show={visible} onClose={handleClose} size="xl">
      <Modal.Header
        title={t('sales_projects.excel_import.apartments_title')}
        subtitle={selectedProject?.name || ''}
        onClose={handleClose}
      />

      <Modal.Body>
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('sales_projects.excel_import.upload_apartment_file')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select the "Tablica stanova" Excel file (.xlsx or .csv) with apartment data
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
              />
              {file && (
                <p className="mt-2 text-sm text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {file.name}
                </p>
              )}
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Expected File Format:</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>Headers on row 1, data starts at row 2</li>
                <li>Column 1 (A): zgrada (building name - must match existing building)</li>
                <li>Column 4 (D): oznaka stana (apartment number)</li>
                <li>Column 10 (J): stan m2 prodajno (total saleable area)</li>
                <li>Column 12 (L): cijena stana (apartment price)</li>
                <li>Columns 13-15: parking data (optional)</li>
                <li>Columns 16-18: storage data (optional)</li>
                <li>Column 20 (T): datum potpisa predugovora (optional)</li>
                <li>Column 21 (U): kapara 10% (optional)</li>
                <li>Columns 22-25 (V-Y): installment dates or credit date (optional)</li>
                <li>Numbers can use European format with commas (e.g., "3.000,00")</li>
                <li>Dates can use DD.MM.YYYY format</li>
              </ul>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Import Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total rows:</span>
                  <span className="ml-2 font-medium">{parsedRows.length}</span>
                </div>
                <div>
                  <span className="text-green-600">Valid rows:</span>
                  <span className="ml-2 font-medium text-green-600">{validRows.length}</span>
                </div>
                <div>
                  <span className="text-red-600">Invalid rows:</span>
                  <span className="ml-2 font-medium text-red-600">{invalidRows.length}</span>
                </div>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-900 dark:text-red-300 mb-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Errors Found ({invalidRows.length} rows)
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {invalidRows.map((row) => (
                    <div key={row.rowIndex} className="text-sm">
                      <span className="font-medium text-red-800 dark:text-red-300">Row {row.rowIndex}:</span>
                      <span className="text-red-700 dark:text-red-400 ml-2">
                        {row.building_label || '(no building)'} - {row.number || '(no number)'} - {row.errors.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Row</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Building</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Apt #</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Floor</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">m²</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Price</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Parking</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Storage</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.errors.length > 0 || !row.building_id ? 'bg-red-50 dark:bg-red-900/20' : ''}
                      >
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.rowIndex}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.building_label}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.number}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.floor}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.size_m2}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">€{row.price.toLocaleString()}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.parking_label || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.storage_label || '-'}</td>
                        <td className="px-3 py-2 text-sm">
                          {row.errors.length === 0 && row.building_id ? (
                            <span className="text-green-600 flex items-center">
                              <CheckCircle className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center">
                              <AlertCircle className="w-4 h-4" />
                            </span>
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
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('sales_projects.excel_import.import_complete')}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">{t('sales_projects.excel_import.successfully_imported')}</div>
                <div className="text-3xl font-bold text-green-700">{importResults.success}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-600 mb-1">{t('sales_projects.excel_import.failed_skipped')}</div>
                <div className="text-3xl font-bold text-red-700">{importResults.failed}</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg p-4">
                <div className="text-sm text-orange-600 mb-1">{t('sales_projects.excel_import.garages_linked')}</div>
                <div className="text-3xl font-bold text-orange-700">{importResults.garagesCreated}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('sales_projects.excel_import.storages_linked')}</div>
                <div className="text-3xl font-bold text-gray-700 dark:text-gray-200">{importResults.storagesCreated}</div>
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
            <Button variant="secondary" onClick={() => setStep(1)}>{t('common.back')}</Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
            >
              {importing ? t('sales_projects.excel_import.importing') : t('sales_projects.excel_import.import_apartments', { count: validRows.length })}
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
