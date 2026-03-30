import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Input, Select, FormField, Form } from '../../../ui'
import { CompanyFormData } from '../types'

interface CompanyFormModalProps {
  show: boolean
  editingCompany: string | null
  formData: CompanyFormData
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onAccountCountChange: (count: number) => void
  onBankAccountChange: (index: number, field: 'bank_name' | 'current_balance' | 'balance_reset_at', value: string | number | null) => void
  onFormDataChange: (field: keyof CompanyFormData, value: CompanyFormData[keyof CompanyFormData]) => void
}

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  show,
  editingCompany,
  formData,
  onClose,
  onSubmit,
  onAccountCountChange,
  onBankAccountChange,
  onFormDataChange
}) => {
  const { t } = useTranslation()
  return (
    <Modal show={show} onClose={onClose} size="sm">
      <Modal.Header
        title={editingCompany ? t('companies.form.title_edit') : t('companies.form.title_new')}
        onClose={onClose}
      />

      <Form onSubmit={onSubmit} className="overflow-y-auto flex-1">
        <div className="p-6 space-y-4">
          <FormField label={t('companies.form.name')} required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => onFormDataChange('name', e.target.value)}
              placeholder="npr. Landmark d.o.o."
            />
          </FormField>

          <FormField label={t('companies.form.oib')} required helperText={t('companies.form.oib_helper')}>
            <Input
              type="text"
              value={formData.oib}
              onChange={(e) => onFormDataChange('oib', e.target.value)}
              placeholder="12345678901"
              maxLength={11}
              pattern="[0-9]{11}"
              title={t('companies.form.oib_title')}
            />
          </FormField>

          {!editingCompany && (
            <FormField label={t('companies.form.account_count')} required helperText={t('companies.form.account_count_helper')}>
              <Select
                value={formData.accountCount}
                onChange={(e) => onAccountCountChange(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </FormField>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('companies.form.bank_accounts_heading')}</h3>
            {formData.bankAccounts.map((account, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-3 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('companies.form.account_label', { number: index + 1 })}</p>
                <FormField label={t('companies.form.bank_name')} required compact>
                  <Input
                    type="text"
                    compact
                    value={account.bank_name}
                    onChange={(e) => onBankAccountChange(index, 'bank_name', e.target.value)}
                    placeholder="npr. Erste banka"
                    disabled={editingCompany !== null}
                  />
                </FormField>
                <FormField label={t('companies.form.current_balance')} required compact>
                  <Input
                    type="number"
                    compact
                    step="0.01"
                    value={account.current_balance}
                    onChange={(e) => onBankAccountChange(index, 'current_balance', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </FormField>
                {editingCompany && (
                  <FormField label={t('companies.form.balance_date')} compact helperText={t('companies.form.balance_date_helper')}>
                    <Input
                      type="date"
                      compact
                      value={account.balance_reset_at || ''}
                      onChange={(e) => onBankAccountChange(index, 'balance_reset_at', e.target.value || null)}
                    />
                  </FormField>
                )}
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {editingCompany ? (
                <>
                  <strong>{t('companies.form.note_label')}</strong> {t('companies.form.note_edit')}
                </>
              ) : (
                <>
                  <strong>{t('companies.form.note_label')}</strong> {t('companies.form.note_new')}
                </>
              )}
            </p>
          </div>
        </div>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">
            {editingCompany ? t('common.save_changes') : t('companies.form.add_label')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default CompanyFormModal
