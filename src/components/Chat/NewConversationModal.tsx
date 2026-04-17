import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, User, Check } from 'lucide-react'
import Modal from '../ui/Modal'
import SearchInput from '../ui/SearchInput'
import LoadingSpinner from '../ui/LoadingSpinner'
import type { ChatUser } from '../../types/chat'
import { fetchAllUsers } from './services/chatService'

interface NewConversationModalProps {
  show: boolean
  onClose: () => void
  currentUserId: string
  onCreate: (
    participantIds: string[],
    name: string | null,
    isGroup: boolean,
  ) => Promise<string | null>
}

const NewConversationModal: React.FC<NewConversationModalProps> = ({
  show,
  onClose,
  currentUserId,
  onCreate,
}) => {
  const { t } = useTranslation()
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const isGroup = selectedIds.length > 1

  useEffect(() => {
    if (!show) return
    setSearch('')
    setSelectedIds([])
    setGroupName('')
    setCreating(false)

    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchAllUsers()
        setUsers(data.filter(u => u.id !== currentUserId))
      } catch (err) {
        console.error('Failed to load users:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [show, currentUserId])

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    return u.username.toLowerCase().includes(search.toLowerCase())
  })

  const toggleUser = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    )
  }

  const handleCreate = async () => {
    if (selectedIds.length === 0) return
    setCreating(true)
    const name = isGroup && groupName.trim() ? groupName.trim() : null
    await onCreate(selectedIds, name, isGroup)
    onClose()
  }

  return (
    <Modal show={show} onClose={onClose} size="sm">
      <Modal.Header title={t('chat.new_conversation')} onClose={onClose} />
      <Modal.Body noPadding>
        <div className="px-4 pt-4 pb-2 space-y-3">
          {isGroup && (
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder={t('chat.group_name_placeholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder={t('chat.search_users')}
            className="w-full"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {selectedIds.map(id => {
              const u = users.find(usr => usr.id === id)
              return (
                <button
                  key={id}
                  onClick={() => toggleUser(id)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <span>{u?.username || id}</span>
                  <span className="text-blue-400">&times;</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <LoadingSpinner size="sm" className="mt-4 mb-4" />
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-6">
              {t('common.no_results')}
            </p>
          ) : (
            filtered.map(u => {
              const isSelected = selectedIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {u.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{u.role}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleCreate}
          disabled={selectedIds.length === 0 || creating}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isGroup ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
          {creating ? t('common.loading') : isGroup ? t('chat.create_group') : t('chat.start_chat')}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default NewConversationModal
