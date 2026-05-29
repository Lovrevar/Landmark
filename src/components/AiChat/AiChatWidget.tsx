import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAiChat } from './AiChatProvider'
import AiChatTrigger from './AiChatTrigger'

// Lazy so react-markdown/remark-gfm (~150 KB) load only when the panel first
// opens, instead of being bundled into the eagerly-mounted widget at startup.
const AiChatPanel = lazy(() => import('./AiChatPanel'))

export default function AiChatWidget() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { isOpen } = useAiChat()

  if (loading || !user) return null
  if (location.pathname === '/chat') return null

  return (
    <>
      <AiChatTrigger />
      {isOpen && (
        <Suspense fallback={null}>
          <AiChatPanel />
        </Suspense>
      )}
    </>
  )
}
