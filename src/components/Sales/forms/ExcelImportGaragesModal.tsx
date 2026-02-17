import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertCircle, Warehouse } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { Modal, Button, LoadingSpinner } from '../../ui'

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
  selectedBuilding: any
  onComplete: () => void
}

export const ExcelImportGaragesModal: React.FC<ExcelImportGaragesModalProps> = ({
  visible,
  onClose,
  selectedBuilding,
  onComplete
}) => {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedGarageRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{
    created: number
    updated: number
    failed: number
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
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      const { data: existingGarages } = await supabase
        .from('garages')
        .select('number')
        .eq('building_id', selectedBuilding.id)

      const existingNumbers = new Set(existingGarages?.map(g => g.number) || [])

      const parsed: ParsedGarageRow[] = rows
        .slice(1)
        .filter(row => row[0])
        .map((row, idx) => ({
          rowIndex: idx + 2,
          number: String(row[0]),
          size_m2: Number(row[1]) || 0,
          price: Number(row[2]) || 0,
          exists: existingNumbers.has(String(row[0]))
        }))

      setParsedRows(parsed)
      setStep(2)
    } catch (error) {
      console.error('Error parsing file:', error)
      alert('Error parsing Excel file. Please check the file format.')
    }
  }

  const handleImport = async () => {
    if (!selectedBuilding) return

    setImporting(true)
    let created = 0
    let updated = 0
    let failed = 0

    try {
      for (const row of parsedRows) {
        try {
          const garageData = {
            building_id: selectedBuilding.id,
            number: row.number,
            size_m2: row.size_m2,
            price: row.price,
            floor: 0,
            status: 'Available'
          }

          if (row.exists) {
            const { error } = await supabase
              .from('garages')
              .update({
                size_m2: row.size_m2,
                price: row.price
              })
              .eq('building_id', selectedBuilding.id)
              .eq('number', row.number)

            if (error) throw error
            updated++
          } else {
            const { error } = await supabase
              .from('garages')
              .insert(garageData)

            if (error) throw error
            created++
          }
        } catch (error) {
          console.error(`Error importing garage ${row.number}:`, error)
          failed++
        }
      }

      setImportResults({ created, updated, failed })
      setStep(3)
    } catch (error) {
      console.error('Import error:', error)
      alert('An error occurred during import. Please check the console.')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
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
        title="Import Garages from Excel"
        subtitle={selectedBuilding ? `Building: ${selectedBuilding.name}` : ''}
        onClose={handleClose}
      />

      <Modal.Body>
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Garages Excel File
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Select an Excel file with 3 columns: parking oznaka, parking m2, parking cijena
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
              {file && (
                <p className="mt-2 text-sm text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {file.name}
                </p>
              )}
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-medium text-orange-900 mb-2">Expected File Format:</h4>
              <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                <li>Header row on row 1</li>
                <li>Column 1: parking oznaka (garage number/label)</li>
                <li>Column 2: parking m2 (size in square meters)</li>
                <li>Column 3: parking cijena (price)</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Building:</strong> {selectedBuilding?.name}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                Garages will be imported to this building. Existing garages with the same number will be updated.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Import Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total garages:</span>
                  <span className="ml-2 font-medium">{parsedRows.length}</span>
                </div>
                <div>
                  <span className="text-green-600">New:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {parsedRows.filter(r => !r.exists).length}
                  </span>
                </div>
                <div>
                  <span className="text-yellow-600">Update existing:</span>
                  <span className="ml-2 font-medium text-yellow-600">
                    {parsedRows.filter(r => r.exists).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Row</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Garage Number</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Size (m²)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.exists ? 'bg-yellow-50' : ''}
                      >
                        <td className="px-4 py-2 text-sm text-gray-900">{row.rowIndex}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">{row.number}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{row.size_m2} m²</td>
                        <td className="px-4 py-2 text-sm text-gray-900">€{row.price.toLocaleString('hr-HR')}</td>
                        <td className="px-4 py-2 text-sm">
                          {row.exists ? (
                            <span className="text-yellow-600 text-xs">Will update</span>
                          ) : (
                            <span className="text-green-600 text-xs">New</span>
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
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">Created</div>
                <div className="text-3xl font-bold text-green-700">{importResults.created}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-600 mb-1">Updated</div>
                <div className="text-3xl font-bold text-yellow-700">{importResults.updated}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-600 mb-1">Failed</div>
                <div className="text-3xl font-bold text-red-700">{importResults.failed}</div>
              </div>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {step === 1 && (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={parseFile}
              disabled={!file}
            >
              Parse File
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={importing || parsedRows.length === 0}
            >
              {importing ? 'Importing...' : `Import ${parsedRows.length} Garages`}
            </Button>
          </>
        )}

        {step === 3 && (
          <Button variant="primary" onClick={handleClose}>Close</Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
