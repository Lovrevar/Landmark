import React from 'react'
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
import { LoadingSpinner, PageHeader, Modal, Button, Badge, Input, Select, Textarea, Card, EmptyState } from '../../ui'
import { format } from 'date-fns'
import { useWorkLogs } from './hooks/useWorkLogs'
import type { WorkLog } from './services/workLogService'

const statusConfig = {
  work_finished: { label: 'Work Finished', icon: CheckCircle2, color: 'green' },
  in_progress: { label: 'In Progress', icon: Loader, color: 'blue' },
  blocker: { label: 'Blocker', icon: AlertTriangle, color: 'red' },
  quality_issue: { label: 'Quality Issue', icon: AlertCircle, color: 'orange' },
  waiting_materials: { label: 'Waiting Materials', icon: Package, color: 'yellow' },
  weather_delay: { label: 'Weather Delay', icon: CloudRain, color: 'gray' },
}

const variantMap: Record<string, 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange'> = {
  green: 'green', red: 'red', yellow: 'yellow', blue: 'blue', gray: 'gray', orange: 'orange',
}

function StatusBadge({ status }: { status: WorkLog['status'] }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <Badge variant={variantMap[config.color] || 'gray'}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  )
}

const WorkLogs: React.FC = () => {
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
  } = useWorkLogs()

  if (loading) {
    return <LoadingSpinner message="Loading work logs..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Logs"
        description="Track subcontractor activities and site observations"
        actions={<Button icon={Plus} onClick={openNewForm}>New Work Log</Button>}
      />

      <Modal show={showForm} onClose={closeForm} size="md">
        <Modal.Header
          title={editingLog ? 'Edit Work Log' : 'New Work Log'}
          onClose={closeForm}
        />

        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project *</label>
                <Select
                  value={formData.project_id}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  required
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phase *</label>
                <Select
                  value={formData.phase_id}
                  onChange={(e) => handlePhaseChange(e.target.value)}
                  disabled={!formData.project_id}
                  required
                >
                  <option value="">Select Phase</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>{phase.phase_name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contract *</label>
              <Select
                value={formData.contract_id}
                onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                disabled={!formData.phase_id}
                required
              >
                <option value="">
                  {!formData.phase_id
                    ? 'Select Phase First'
                    : contracts.length === 0
                      ? 'No active contracts in this phase'
                      : 'Select Contract'}
                </option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.contract_number} - {contract.subcontractors?.name} - {contract.job_description}
                  </option>
                ))}
              </Select>
              {formData.phase_id && contracts.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  No active contracts found for this phase. Make sure contracts exist in Site Management.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as WorkLog['status'] })}
                  required
                >
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Work Description *</label>
              <Textarea
                value={formData.work_description}
                onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                rows={3}
                placeholder="Describe the work performed or observed..."
                required
              />
            </div>

            {(formData.status === 'blocker' || formData.status === 'quality_issue') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.status === 'blocker' ? 'Blocker Details' : 'Issue Details'}
                </label>
                <Textarea
                  value={formData.blocker_details}
                  onChange={(e) => setFormData({ ...formData, blocker_details: e.target.value })}
                  rows={2}
                  placeholder={formData.status === 'blocker' ? 'Describe what is blocking the work...' : 'Describe the quality issue...'}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Any additional observations or notes..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Palette className="w-4 h-4 inline mr-1" />
                Color (for dashboard)
              </label>
              <div className="grid grid-cols-8 gap-2">
                {['blue', 'green', 'red', 'yellow', 'orange', 'purple', 'pink', 'gray'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color === 'yellow' ? '#fbbf24' : color === 'orange' ? '#f97316' : color === 'purple' ? '#a855f7' : color === 'pink' ? '#ec4899' : color === 'gray' ? '#6b7280' : color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button type="submit">
              {editingLog ? 'Update Work Log' : 'Create Work Log'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Card variant="default" padding="none">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
            Work Log History
          </h2>
        </div>
        <div className="p-6">
          {workLogs.length === 0 ? (
            <Card variant="bordered" padding="lg" className="bg-gray-50">
              <EmptyState
                icon={Wrench}
                title="No work logs yet"
                description="Start tracking subcontractor activities by creating your first work log"
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {workLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-l-4 rounded-lg hover:shadow-md transition-shadow bg-white border border-gray-200"
                  style={{ borderLeftColor: log.color || 'blue' }}
                >
                  <Card variant="bordered" padding="md">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{log.subcontractors?.name}</h3>
                          <StatusBadge status={log.status} />
                        </div>
                        <p className="text-sm text-gray-600">
                          {log.projects?.name} {log.project_phases?.phase_name && `• ${log.project_phases.phase_name}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Contract: {log.contracts?.contract_number} - {log.contracts?.job_description}
                        </p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="text-right mr-2">
                          <div className="flex items-center text-gray-600 text-sm mb-1">
                            <Calendar className="w-4 h-4 mr-1" />
                            {format(new Date(log.date), 'MMM dd, yyyy')}
                          </div>
                          <p className="text-xs text-gray-500">
                            Logged {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                        <Button size="icon-md" variant="ghost" icon={Edit2} onClick={() => openEditForm(log)} title="Edit" className="text-blue-600 hover:bg-blue-50" />
                        <Button size="icon-md" variant="ghost" icon={Trash2} onClick={() => handleDelete(log.id)} title="Delete" className="text-red-600 hover:bg-red-50" />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg mb-3">
                      <p className="text-sm text-gray-700">{log.work_description}</p>
                    </div>

                    {log.blocker_details && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-3">
                        <p className="text-xs font-medium text-red-800 mb-1">
                          {log.status === 'blocker' ? 'Blocker Details:' : 'Issue Details:'}
                        </p>
                        <p className="text-sm text-red-700">{log.blocker_details}</p>
                      </div>
                    )}

                    {log.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                        <p className="text-sm text-gray-600">{log.notes}</p>
                      </div>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default WorkLogs
