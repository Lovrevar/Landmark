import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Users } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Textarea from '../ui/Textarea'
import ConfirmDialog from '../ui/ConfirmDialog'
import SearchableSelect from '../ui/SearchableSelect'
import ToggleSwitch from '../ui/ToggleSwitch'
import ParticipantPicker from '../Calendar/components/ParticipantPicker'
import { fetchProjectOptions, fetchTaskUsers, type ProjectOption } from './services/tasksService'
import { useAuth } from '../../contexts/AuthContext'
import type { NewTaskInput, TaskUser } from '../../types/tasks'

interface Props {
  show: boolean
  defaultProjectId?: string | null
  defaultPrivate?: boolean
  onClose: () => void
  onCreate: (input: NewTaskInput) => Promise<void>
}

interface FormState {
  title: string
  description: string
  projectId: string | null
  dueDate: string
  isPrivate: boolean
  assigneeIds: string[]
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  projectId: null,
  dueDate: '',
  isPrivate: false,
  assigneeIds: [],
}

const TaskModal: React.FC<Props> = ({
  show,
  defaultProjectId = null,
  defaultPrivate = false,
  onClose,
  onCreate,
}) => {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])
  const [saving, setSaving] = useState(false)
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!show) return
    setForm({ ...EMPTY_FORM, projectId: defaultProjectId, isPrivate: defaultPrivate })
    fetchProjectOptions().then(setProjects).catch(() => setProjects([]))
    fetchTaskUsers().then(setUsers).catch(() => setUsers([]))
  }, [show, defaultProjectId, defaultPrivate])

  const dirty = useMemo(
    () =>
      form.title !== '' ||
      form.description !== '' ||
      form.projectId !== defaultProjectId ||
      form.dueDate !== '' ||
      form.isPrivate !== defaultPrivate ||
      form.assigneeIds.length > 0,
    [form, defaultProjectId, defaultPrivate],
  )

  const projectOptions = useMemo(
    () => projects.map(p => ({ value: p.id, label: p.name })),
    [projects],
  )

  const tryClose = () => {
    if (!saving && dirty) {
      setShowConfirmDiscard(true)
      return
    }
    onClose()
  }

  const submit = async () => {
    if (!user || !form.title.trim()) return
    setSaving(true)
    try {
      const input: NewTaskInput = {
        title: form.title.trim(),
        description: form.description,
        deadline: form.dueDate || null,
        is_private: form.isPrivate,
        project_id: form.projectId,
        assignee_ids: form.isPrivate ? [] : form.assigneeIds,
      }
      await onCreate(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }

  if (!show) return null

  return (
    <>
      <Modal show={show} onClose={tryClose} size="md">
        <Modal.Header title={t('tasks.modal.new_title')} onClose={tryClose} />
        <Modal.Body>
          <div onKeyDown={handleKeyDown} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tasks.modal.title_label')}
              </label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tasks.modal.project_label')}
                </label>
                <SearchableSelect
                  value={form.projectId}
                  options={projectOptions}
                  onChange={v => setForm(f => ({ ...f, projectId: v }))}
                  placeholder={t('tasks.modal.project_placeholder')}
                  searchPlaceholder={t('tasks.modal.project_search_placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tasks.modal.due_date_label')}
                </label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <ToggleSwitch
                checked={form.isPrivate}
                onChange={v => setForm(f => ({ ...f, isPrivate: v }))}
                label={t('tasks.modal.private_label')}
                description={t('tasks.modal.private_description')}
              />
            </div>

            {!form.isPrivate && (
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4" /> {t('tasks.modal.assign_label')}
                </label>
                <ParticipantPicker
                  users={users}
                  selectedIds={form.assigneeIds}
                  onChange={ids => setForm(f => ({ ...f, assigneeIds: ids }))}
                  excludeId={user?.auth_user_id}
                  placeholder={t('tasks.modal.assign_placeholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tasks.modal.description_label')}
              </label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                placeholder={t('tasks.modal.description_placeholder')}
              />
              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {t('tasks.attachments.create_first')}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={tryClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!form.title.trim()}>
            {t('tasks.modal.create_button')}
          </Button>
        </Modal.Footer>
      </Modal>
      <ConfirmDialog
        show={showConfirmDiscard}
        title={t('tasks.modal.discard_title')}
        message={t('tasks.modal.discard_message')}
        variant="danger"
        confirmLabel={t('tasks.modal.discard_confirm')}
        onConfirm={() => {
          setShowConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setShowConfirmDiscard(false)}
      />
    </>
  )
}

export default TaskModal
