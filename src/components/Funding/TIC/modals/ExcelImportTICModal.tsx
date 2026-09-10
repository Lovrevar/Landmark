import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, Upload } from 'lucide-react'
import { Modal, Button, Alert } from '../../../ui'
import { parseTICFile, type ParsedWorkbook } from '../services/ticImport'

interface ExcelImportTICModalProps {
  show: boolean
  onClose: () => void
  projectName?: string
  onImport: (parsed: ParsedWorkbook, fileName: string) => void
}

const countConstructionItems = (parsed: ParsedWorkbook) =>
  parsed.construction?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0

const ExcelImportTICModal: React.FC<ExcelImportTICModalProps> = ({ show, onClose, projectName, onImport }) => {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  const reset = () => {
    setStep(1)
    setFile(null)
    setParsed(null)
    setParseError(null)
    setParsing(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setParseError(null)
    try {
      const result = await parseTICFile(file)
      if (!result.investment && !result.construction) {
        setParseError(t('tic.import.error_no_sheets'))
        return
      }
      setParsed(result)
      setStep(2)
    } catch (error) {
      console.error('Error parsing TIC file:', error)
      setParseError(t('tic.import.error_parse_failed'))
    } finally {
      setParsing(false)
    }
  }

  const handleConfirm = () => {
    if (!parsed || !file) return
    onImport(parsed, file.name)
    setStep(3)
  }

  if (!show) return null

  return (
    <Modal show={show} onClose={handleClose} size="lg">
      <Modal.Header
        title={t('tic.import.title')}
        subtitle={projectName}
        onClose={handleClose}
      />

      <Modal.Body>
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('tic.import.upload_heading')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('tic.import.upload_hint')}</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setParseError(null)
                }}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30"
              />
              {file && (
                <p className="mt-2 text-sm text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {file.name}
                </p>
              )}
            </div>

            {parseError && <Alert variant="error">{parseError}</Alert>}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                {t('tic.import.format_heading')}
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>{t('tic.import.format_sheets')}</li>
                <li>{t('tic.import.format_header')}</li>
                <li>{t('tic.import.format_investment')}</li>
                <li>{t('tic.import.format_construction')}</li>
                <li>{t('tic.import.format_totals')}</li>
              </ul>
            </div>
          </div>
        )}

        {step === 2 && parsed && (
          <div className="space-y-4">
            <Alert variant="warning">{t('tic.import.replace_warning')}</Alert>

            {parsed.investment && parsed.investment.unphasedRows.length > 0 && (
              <Alert variant="info" className="mb-4">
                <strong>{t('tic.import.unphased_title')}</strong>{' '}
                {t('tic.import.unphased_body')}
                <ul className="mt-1 list-disc list-inside">
                  {parsed.investment.unphasedRows.map(name => <li key={name}>{name}</li>)}
                </ul>
              </Alert>
            )}

            {parsed.investment && parsed.investment.inconsistentRows.length > 0 && (
              <Alert variant="warning" className="mb-4">
                <strong>{t('tic.import.inconsistent_title')}</strong>{' '}
                {t('tic.import.inconsistent_body')}
                <ul className="mt-1 list-disc list-inside">
                  {parsed.investment.inconsistentRows.map(name => <li key={name}>{name}</li>)}
                </ul>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  {t('tic.tab_investment')}
                </div>
                {parsed.investment ? (
                  <>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {parsed.investment.lineItems.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('tic.import.rows_from_sheet', { sheet: parsed.investment.sheetName })}
                    </div>
                    {parsed.investment.phaseNumbers.length > 0 && (
                      <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        {t('tic.import.phases_found', { count: parsed.investment.phaseNumbers.length })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">{t('tic.import.tab_unchanged')}</div>
                )}
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  {t('tic.tab_construction')}
                </div>
                {parsed.construction ? (
                  <>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {countConstructionItems(parsed)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('tic.import.items_from_sheet', {
                        sections: parsed.construction.sections.length,
                        sheet: parsed.construction.sheetName,
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">{t('tic.import.tab_unchanged')}</div>
                )}
              </div>
            </div>

            {(parsed.investorName || parsed.documentDate) && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {parsed.investorName && (
                  <div>
                    <span className="font-medium">{t('tic.investor_label')}</span> {parsed.investorName}
                  </div>
                )}
                {parsed.documentDate && (
                  <div>
                    <span className="font-medium">{t('tic.date_label')}</span> {parsed.documentDate}
                  </div>
                )}
              </div>
            )}

            {parsed.errors.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('tic.import.skipped_sheets')}
                </h4>
                <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                  {parsed.errors.map((sheetError) => (
                    <li key={sheetError.sheetName}>
                      <strong>{sheetError.sheetName}</strong> — {t(`tic.import.error_${sheetError.error}`, {
                        defaultValue: t('tic.import.error_parse_failed'),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.investment && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t('tic.col_purpose')}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t('tic.col_own_funds')}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t('tic.col_credit_funds')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {parsed.investment.lineItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.name}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            {item.vlastita.toLocaleString('hr-HR')}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            {item.kreditna.toLocaleString('hr-HR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('tic.import.complete_title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{t('tic.import.complete_save_reminder')}</p>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {step === 1 && (
          <>
            <Button variant="secondary" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleParse} disabled={!file} loading={parsing}>
              {t('tic.import.parse_file')}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Button variant="secondary" onClick={() => setStep(1)}>
              {t('common.back')}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t('tic.import.confirm')}
            </Button>
          </>
        )}

        {step === 3 && (
          <Button variant="primary" onClick={handleClose}>
            {t('common.close')}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}

export default ExcelImportTICModal
