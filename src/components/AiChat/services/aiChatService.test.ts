import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FakeDb } from '../../../test/fakeSupabase'

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
const flags = vi.hoisted(() => ({ voice: false }))
vi.mock('../../../lib/featureFlags', () => ({
  get VOICE_CALLS_ENABLED() { return flags.voice },
}))
vi.mock('../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { listSessions } from './aiChatService'

const session = (id: string, updated_at: string, extra: Record<string, unknown> = {}) =>
  ({ id, user_id: 'u1', title: id, created_at: updated_at, updated_at, cancel_requested_at: null, ...extra })

describe('listSessions and the voice-calls flag', () => {
  afterEach(() => {
    flags.voice = false
    db.tables = {}
  })

  it('without the flag, lists every session and never filters on channel (absent before the voice migration)', async () => {
    flags.voice = false
    // A database without the voice migration: the rows have no channel column at all.
    db.tables.ai_sessions = [session('a', '2026-10-20T10:00:00Z'), session('b', '2026-10-21T10:00:00Z')]
    expect((await listSessions()).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('with the flag, voice calls are left out of the chat history', async () => {
    flags.voice = true
    db.tables.ai_sessions = [
      session('chat-1', '2026-10-20T10:00:00Z', { channel: 'chat' }),
      session('call-1', '2026-10-21T10:00:00Z', { channel: 'voice' }),
    ]
    expect((await listSessions()).map((s) => s.id)).toEqual(['chat-1'])
  })
})
