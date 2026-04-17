import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, CheckSquare, Inbox, Send, Lock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTasks } from './hooks/useTasks'
import ConfirmDialog from '../ui/ConfirmDialog'
import type { Task } from '../../types/tasks'
import TaskCard from './TaskCard'
import NewTaskModal from './NewTaskModal'
import TaskDetailModal from './TaskDetailModal'

type TabKey = 'assigned' | 'created' | 'private'

const TasksPage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { assigned, created, privateTasks, loading, create, toggleStatus, remove } = useTasks()
  const [tab, setTab] = useState<TabKey>('assigned')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)

  const currentList = tab === 'assigned' ? assigned : tab === 'created' ? created : privateTasks

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(pendingDelete)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tasks.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('tasks.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('tasks.new_task')}
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
        <TabBtn active={tab === 'assigned'} onClick={() => setTab('assigned')} icon={<Inbox className="w-4 h-4" />} label={t('tasks.tabs.assigned')} count={assigned.length} />
        <TabBtn active={tab === 'created'} onClick={() => setTab('created')} icon={<Send className="w-4 h-4" />} label={t('tasks.tabs.created')} count={created.length} />
        <TabBtn active={tab === 'private'} onClick={() => setTab('private')} icon={<Lock className="w-4 h-4" />} label={t('tasks.tabs.private')} count={privateTasks.length} />
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('tasks.loading')}</div>
      ) : currentList.length === 0 ? (
        <div className="py-12 text-center">
          <CheckSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{t('tasks.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentList.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={user?.id || ''}
              onToggleStatus={toggleStatus}
              onDelete={(t) => setPendingDelete(t)}
              onClick={(t) => setSelected(t)}
            />
          ))}
        </div>
      )}

      <NewTaskModal show={showNew} onClose={() => setShowNew(false)} onCreate={create} />
      <TaskDetailModal task={selected} onClose={() => setSelected(null)} />
      <ConfirmDialog
        show={!!pendingDelete}
        title={t('tasks.detail.delete_task_confirm_title')}
        message={t('tasks.detail.delete_task_confirm_message')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

interface TabBtnProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}

const TabBtn: React.FC<TabBtnProps> = ({ active, onClick, icon, label, count }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
  >
    {icon}
    <span>{label}</span>
    <span className={`px-2 py-0.5 rounded-full text-xs ${active ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{count}</span>
  </button>
)

export default TasksPage
