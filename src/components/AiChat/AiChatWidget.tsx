import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAiChat } from './AiChatProvider'
import AiChatTrigger from './AiChatTrigger'
import AiChatPanel from './AiChatPanel'

export default function AiChatWidget() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { isOpen } = useAiChat()

  if (loading || !user) return null
  if (location.pathname === '/chat') return null

  return (
    <>
      <AiChatTrigger />
      {isOpen && <AiChatPanel />}
    </>
  )
}
