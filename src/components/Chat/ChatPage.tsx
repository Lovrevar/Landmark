import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { useChat } from './hooks/useChat'
import ConversationList from './ConversationList'
import MessagePanel from './MessagePanel'
import NewConversationModal from './NewConversationModal'

const ChatPage: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [showNewModal, setShowNewModal] = useState(false)
  const [mobileShowMessages, setMobileShowMessages] = useState(false)

  const {
    conversations,
    activeConversation,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sendingMessage,
    selectConversation,
    sendMessage,
    createConversation,
  } = useChat()

  if (!user) return null

  const handleSelectConversation = (id: string) => {
    selectConversation(id)
    setMobileShowMessages(true)
  }

  const handleBack = () => {
    setMobileShowMessages(false)
  }

  const handleCreate = async (
    participantIds: string[],
    name: string | null,
    isGroup: boolean,
  ): Promise<string | null> => {
    const id = await createConversation(participantIds, name, isGroup)
    if (id) setMobileShowMessages(true)
    return id
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className={`w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 ${
          mobileShowMessages ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          currentUserId={user.id}
          loading={loadingConversations}
          onSelect={handleSelectConversation}
          onNewConversation={() => setShowNewModal(true)}
        />
      </div>

      <div
        className={`flex-1 flex flex-col min-w-0 ${
          mobileShowMessages ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <MessagePanel
          conversation={activeConversation}
          messages={messages}
          currentUserId={user.id}
          loading={loadingMessages}
          sending={sendingMessage}
          onSendMessage={sendMessage}
          onBack={handleBack}
        />
      </div>

      <NewConversationModal
        show={showNewModal}
        onClose={() => setShowNewModal(false)}
        currentUserId={user.id}
        onCreate={handleCreate}
      />
    </div>
  )
}

export default ChatPage
