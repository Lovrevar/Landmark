import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ClipboardCheck,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader,
  AlertCircle,
  CloudRain,
  Package,
  Edit2,
  Trash2,
  Palette,
  Wrench
} from 'lucide-react'
import { LoadingSpinner, PageHeader, Modal, Button, Badge, Input, Select, Textarea, Card, EmptyState, Form, FormField, ConfirmDialog } from '../../ui'
import { format } from 'date-fns'
import { useWorkLogs } from './hooks/useWorkLogs'
import type { WorkLog } from './services/workLogService'

const statusConfig = {
  work_finished: { tKey: 'supervision.work_logs.status.work_finished', icon: CheckCircle2, color: 'green' },
  in_progress: { tKey: 'supervision.work_logs.status.in_progress', icon: Loader, color: 'blue' },
  blocker: { tKey: 'supervision.work_logs.status.blocker', icon: AlertTriangle, color: 'red' },
  quality_issue: { tKey: 'supervision.work_logs.status.quality_issue', icon: AlertCircle, color: 'orange' },
  waiting_materials: { tKey: 'supervision.work_logs.status.waiting_materials', icon: Package, color: 'yellow' },
  weather_delay: { tKey: 'supervision.work_logs.status.weather_delay', icon: CloudRain, color: 'gray' },
}

const variantMap: Record<string, 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange'> = {
  green: 'green', red: 'red', yellow: 'yellow', blue: 'blue', gray: 'gray', orange: 'orange',
}

function StatusBadge({ status }: { status: WorkLog['status'] }) {
  const { t } = useTranslation()
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <Badge variant={variantMap[config.color] || 'gray'}>
      <Icon className="w-3 h-3 mr-1" />
      {t(config.tKey)}
    </Badge>
  )
}

const WorkLogs: React.FC = () => {
  const { t } = useTranslation()
  const {
    workLogs,
    projects,
    phases,
    contracts,
    loading,
    showForm,
    editingLog,
    formData,
    setFormData,
    openNewForm,
    openEditForm,
    closeForm,
    handleProjectChange,
    handlePhaseChange,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
  } = useWorkLogs()

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleValidatedSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.project_id) errors.project_id = t('supervision.work_logs.errors.project')
    if (!formData.phase_id) errors.phase_id = t('supervision.work_logs.errors.phase')
    if (!formData.contract_id) errors.contract_id = t('supervision.work_logs.errors.contract')
    if (!formData.date) errors.date = t('supervision.work_logs.errors.date')
    if (!formData.work_description?.trim()) errors.work_description = t('supervision.work_logs.errors.description')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    handleSubmit(e)
  }

  if (loading) {
    return <LoadingSpinner message={t('supervision.work_logs.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('supervision.work_logs.title')}
        description={t('supervision.work_logs.subtitle')}
        actions={<Button icon={Plus} onClick={openNewForm}>{t('supervision.work_logs.new_log')}</Button>}
      />

      <Modal show={showForm} onClose={closeForm} size="md">
        <Modal.Header
          title={editingLog ? t('supervision.work_logs.edit_log') : t('supervision.work_logs.new_log')}
          onClose={closeForm}
        />

        <Form onSubmit={handleValidatedSubmit}>
          <Modal.Body>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('supervision.work_logs.form.project')} required error={fieldErrors.project_id}>
                <Select
                  value={formData.project_id}
                  onChange={(e) => handleProjectChange(e.target.value)}
                >
                  <option value="">{t('supervision.work_logs.form.select_project')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label={t('supervision.work_logs.form.phase')} required error={fieldErrors.phase_id}>
                <Select
                  value={formData.phase_id}
                  onChange={(e) => handlePhaseChange(e.target.value)}
                  disabled={!formData.project_id}
                >
                  <option value="">{t('supervision.work_logs.form.select_phase')}</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>{phase.phase_name}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label={t('supervision.work_logs.form.contract')} required error={fieldErrors.contract_id}>
              <Select
                value={formData.contract_id}
                onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                disabled={!formData.phase_id}
              >
                <option value="">
                  {!formData.phase_id
                    ? t('supervision.work_logs.form.select_phase_first')
                    : contracts.length === 0
                      ? t('supervision.work_logs.form.no_contracts')
                      : t('supervision.work_logs.form.select_contract')}
                </option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.contract_number} - {contract.subcontractors?.name} - {contract.job_description}
                  </option>
                ))}
              </Select>
              {formData.phase_id && contracts.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  {t('supervision.work_logs.form.no_contracts_hint')}
                </p>
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('supervision.work_logs.form.date')} required error={fieldErrors.date}>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </FormField>

              <FormField label={t('supervision.work_logs.form.status')} required>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as WorkLog['status'] })}
                >
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <option key={value} value={value}>{t(config.tKey)}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label={t('supervision.work_logs.form.description')} required error={fieldErrors.work_description}>
              <Textarea
                value={formData.work_description}
                onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                rows={3}
                placeholder={t('supervision.work_logs.form.desc_placeholder')}
              />
            </FormField>

            {(formData.status === 'blocker' || formData.status === 'quality_issue') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {formData.status === 'blocker' ? t('supervision.work_logs.form.blocker_details') : t('supervision.work_logs.form.issue_details')}
                </label>
                <Textarea
                  value={formData.blocker_details}
                  onChange={(e) => setFormData({ ...formData, blocker_details: e.target.value })}
                  rows={2}
                  placeholder={formData.status === 'blocker' ? t('supervision.work_logs.form.blocker_placeholder') : t('supervision.work_logs.form.issue_placeholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('supervision.work_logs.form.additional_notes')}</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder={t('supervision.work_logs.form.notes_placeholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Palette className="w-4 h-4 inline mr-1" />
                {t('supervision.work_logs.form.color_label')}
              </label>
              <div className="grid grid-cols-8 gap-2">
                {['blue', 'green', 'red', 'yellow', 'orange', 'purple', 'pink', 'gray'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      formData.color === color ? 'border-gray-900 dark:border-white scale-110' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color === 'yellow' ? '#fbbf24' : color === 'orange' ? '#f97316' : color === 'purple' ? '#a855f7' : color === 'pink' ? '#ec4899' : color === 'gray' ? '#6b7280' : color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button type="button" variant="ghost" onClick={closeForm}>{t('common.cancel')}</Button>
            <Button type="submit">
              {editingLog ? t('supervision.work_logs.update_log') : t('supervision.work_logs.create_log')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Card variant="default" padding="none">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
            {t('supervision.work_logs.history')}
          </h2>
        </div>
        <div className="p-6">
          {workLogs.length === 0 ? (
            <Card variant="bordered" padding="lg" className="bg-gray-50 dark:bg-gray-700/50">
              <EmptyState
                icon={Wrench}
                title={t('supervision.work_logs.no_logs')}
                description={t('supervision.work_logs.no_logs_desc')}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {workLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-l-4 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  style={{ borderLeftColor: log.color || 'blue' }}
                >
                  <Card variant="bordered" padding="md">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{log.subcontractors?.name}</h3>
                          <StatusBadge status={log.status} />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {log.projects?.name} {log.project_phases?.phase_name && `• ${log.project_phases.phase_name}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('supervision.work_logs.contract_label')} {log.contracts?.contract_number} - {log.contracts?.job_description}
                        </p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="text-right mr-2">
                          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mb-1">
                            <Calendar className="w-4 h-4 mr-1" />
                            {format(new Date(log.date), 'MMM dd, yyyy')}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('supervision.work_logs.logged')} {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                        <Button size="icon-md" variant="ghost" icon={Edit2} onClick={() => openEditForm(log)} title="Edit" className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" />
                        <Button size="icon-md" variant="ghost" icon={Trash2} onClick={() => handleDelete(log.id)} title="Delete" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" />
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mb-3">
                      <p className="text-sm text-gray-700 dark:text-gray-200">{log.work_description}</p>
                    </div>

                    {log.blocker_details && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg mb-3">
                        <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">
                          {log.status === 'blocker' ? t('supervision.work_logs.blocker_details_label') : t('supervision.work_logs.issue_details_label')}
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-400">{log.blocker_details}</p>
                      </div>
                    )}

                    {log.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">{t('supervision.work_logs.notes_label')}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{log.notes}</p>
                      </div>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('common.confirm_delete')}
        message={t('supervision.work_logs.delete_message')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default WorkLogs
