import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Users } from 'lucide-react'
import Modal from '../ui/Modal'
import { fetchTaskUsers } from './services/tasksService'
import type { NewTaskInput, TaskPriority, TaskUser } from '../../types/tasks'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  show: boolean
  onClose: () => void
  onCreate: (input: NewTaskInput) => Promise<void>
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'text-gray-600',
  normal: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
}

const priorityOrder: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

const NewTaskModal: React.FC<Props> = ({ show, onClose, onCreate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [isPrivate, setIsPrivate] = useState(false)
  const [assignees, setAssignees] = useState<string[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (show) {
      fetchTaskUsers().then(setUsers).catch(() => setUsers([]))
      setTitle(''); setDescription(''); setDueDate(''); setDueTime('')
      setPriority('normal'); setIsPrivate(false); setAssignees([])
    }
  }, [show])

  const toggleAssignee = (id: string) => {
    setAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const submit = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    try {
      const input: NewTaskInput = {
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || null,
        due_time: dueTime || null,
        priority,
        is_private: isPrivate,
        assignee_ids: isPrivate ? [] : assignees,
      }
      await onCreate(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} size="md">
      <Modal.Header title={t('tasks.modal.new_title')} onClose={onClose} />
      <Modal.Body>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tasks.modal.title_label')}</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tasks.modal.description_label')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tasks.modal.due_date_label')}</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tasks.modal.due_time_label')}</label>
            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tasks.modal.priority_label')}</label>
          <div className="flex gap-2">
            {priorityOrder.map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border ${priority === value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600'} ${priorityColors[value]}`}
              >
                {t(`tasks.priority.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input id="private" type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
          <label htmlFor="private" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Lock className="w-4 h-4" /> {t('tasks.modal.private_label')}
          </label>
        </div>
        {!isPrivate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Users className="w-4 h-4" /> {t('tasks.modal.assign_label')}
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
              {users.filter(u => u.id !== user?.id).map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleAssignee(u.id)}
                  className={`w-full px-3 py-2 text-left flex justify-between items-center text-sm ${assignees.includes(u.id) ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  <span className="text-gray-900 dark:text-gray-100">{u.username}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{t('common.cancel')}</button>
        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? t('tasks.modal.saving') : t('tasks.modal.create_button')}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default NewTaskModal
