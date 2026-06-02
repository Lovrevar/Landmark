/* eslint-disable react-refresh/only-export-components */
// Co-locates AiChatProvider with the useAiChat hook (idiomatic context pattern);
// the mixed-exports warning is a fast-refresh DX concern, not correctness.
import { createContext, useContext, type ReactNode } from 'react'
import { useAiChatStore, type AiChatStore } from './hooks/useAiChatStore'

const AiChatContext = createContext<AiChatStore | null>(null)

interface AiChatProviderProps {
  children: ReactNode
}

export default function AiChatProvider({ children }: AiChatProviderProps) {
  const store = useAiChatStore()
  return <AiChatContext.Provider value={store}>{children}</AiChatContext.Provider>
}

export function useAiChat(): AiChatStore {
  const ctx = useContext(AiChatContext)
  if (ctx === null) {
    throw new Error('useAiChat must be used within an <AiChatProvider>')
  }
  return ctx
}
