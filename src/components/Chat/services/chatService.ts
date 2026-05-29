import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import type { ChatConversation, ChatMessage, ChatUser, ChatParticipant } from '../../../types/chat'

// Shape of one row from the get_chat_conversation_summaries() RPC. Declared
// locally because the migration that adds the RPC
// (20260529120000_chat_conversation_summaries.sql) must be applied before
// `npm run db:types` can pick it up into src/types/database.ts; until then the
// generated Database type doesn't know the function, so we bridge with a cast.
type ChatConversationSummaryRow = {
  id: string
  name: string | null
  is_group: boolean
  created_by: string
  created_at: string
  last_message_id: string | null
  last_content: string | null
  last_created_at: string | null
  last_sender_id: string | null
  last_file_url: string | null
  last_file_name: string | null
  last_file_size: number | null
  last_file_type: string | null
  unread_count: number
}

type ParticipantWithUserRow = {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
  user: ChatUser | null
}

const MSG_FIELDS = 'id, conversation_id, sender_id, content, created_at, file_url, file_name, file_size, file_type'

const MAX_FILE_SIZE = 25 * 1024 * 1024

export async function fetchAllUsers(): Promise<ChatUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role')
    .order('username')

  if (error) throw error
  return data || []
}

export async function fetchConversations(): Promise<ChatConversation[]> {
  // Last message + unread count are computed server-side (bounded by #conversations,
  // not total message volume — see the RPC's migration). The caller is derived from
  // auth.uid() inside the function, so no userId argument is needed.
  const { data: summaryData, error: sErr } = await supabase.rpc(
    'get_chat_conversation_summaries' as never,
  )
  if (sErr) throw sErr

  const summaries = (summaryData as unknown as ChatConversationSummaryRow[] | null) ?? []
  if (summaries.length === 0) return []

  const conversationIds = summaries.map(s => s.id)

  // Participants + their user record in one batched, bounded query (FK embed on
  // chat_participants.user_id -> users.id).
  const { data: participantData, error: pErr } = await supabase
    .from('chat_participants')
    .select('id, conversation_id, user_id, joined_at, last_read_at, user:user_id (id, username, role)')
    .in('conversation_id', conversationIds)

  if (pErr) throw pErr

  const participantRows = (participantData as unknown as ParticipantWithUserRow[] | null) ?? []

  const participantsByConv = new Map<string, ChatParticipant[]>()
  const userById = new Map<string, ChatUser>()
  for (const p of participantRows) {
    const user = p.user || undefined
    if (user) userById.set(p.user_id, user)
    const participant: ChatParticipant = {
      id: p.id,
      conversation_id: p.conversation_id,
      user_id: p.user_id,
      joined_at: p.joined_at,
      last_read_at: p.last_read_at,
      user,
    }
    const bucket = participantsByConv.get(p.conversation_id)
    if (bucket) bucket.push(participant)
    else participantsByConv.set(p.conversation_id, [participant])
  }

  // The RPC already orders by last activity (desc), so preserve its order.
  return summaries.map(s => {
    const lastMessage: ChatMessage | null = s.last_message_id
      ? {
          id: s.last_message_id,
          conversation_id: s.id,
          sender_id: s.last_sender_id ?? '',
          content: s.last_content ?? '',
          created_at: s.last_created_at ?? s.created_at,
          file_url: s.last_file_url,
          file_name: s.last_file_name,
          file_size: s.last_file_size,
          file_type: s.last_file_type,
          sender: s.last_sender_id ? userById.get(s.last_sender_id) : undefined,
        }
      : null

    return {
      id: s.id,
      name: s.name,
      is_group: s.is_group,
      created_by: s.created_by,
      created_at: s.created_at,
      participants: participantsByConv.get(s.id) || [],
      last_message: lastMessage,
      unread_count: Number(s.unread_count) || 0,
    }
  })
}

export async function fetchMessages(
  conversationId: string,
  limit = 50,
  offset = 0,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(MSG_FIELDS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const senderIds = [...new Set((data || []).map(m => m.sender_id))]
  if (senderIds.length === 0) return []

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, username, role')
    .in('id', senderIds)

  if (uErr) throw uErr

  const userMap = new Map((users || []).map(u => [u.id, u]))

  return (data || [])
    .map(m => ({ ...m, sender: userMap.get(m.sender_id) || undefined }))
    .reverse()
}

export async function uploadChatFile(
  file: File,
  conversationId: string,
): Promise<{ url: string; name: string; size: number; type: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('FILE_TOO_LARGE')
  }

  const ext = file.name.split('.').pop() || 'bin'
  const path = `${conversationId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('chat-attachments')
    .upload(path, file)

  if (uploadErr) throw uploadErr

  const { data: urlData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(path)

  return {
    url: urlData.publicUrl,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  attachment?: { url: string; name: string; size: number; type: string } | null,
): Promise<ChatMessage> {
  const row: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    content,
  }

  if (attachment) {
    row.file_url = attachment.url
    row.file_name = attachment.name
    row.file_size = attachment.size
    row.file_type = attachment.type
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(row)
    .select(MSG_FIELDS)
    .single()

  if (error) throw error

  return data
}

export async function createConversation(
  creatorId: string,
  participantIds: string[],
  name: string | null,
  isGroup: boolean,
): Promise<string> {
  if (!isGroup && participantIds.length === 1) {
    const existingId = await findExistingDirectConversation(creatorId, participantIds[0])
    if (existingId) return existingId
  }

  const { data: conv, error: cErr } = await supabase
    .from('chat_conversations')
    .insert({ name, is_group: isGroup, created_by: creatorId })
    .select('id')
    .single()

  if (cErr) throw cErr

  const allParticipants = [creatorId, ...participantIds.filter(id => id !== creatorId)]
  const rows = allParticipants.map(uid => ({
    conversation_id: conv.id,
    user_id: uid,
  }))

  const { error: pErr } = await supabase
    .from('chat_participants')
    .insert(rows)

  if (pErr) throw pErr

  logActivity({
    action: 'conversation.create',
    entity: 'conversation',
    entityId: conv.id,
    severity: 'medium',
    metadata: {
      entity_name: name,
      is_group: isGroup,
      participant_count: allParticipants.length,
    },
  })

  return conv.id
}

async function findExistingDirectConversation(
  userA: string,
  userB: string,
): Promise<string | null> {
  const { data: myConvIds } = await supabase
    .from('chat_participants')
    .select('conversation_id')
    .eq('user_id', userA)

  if (!myConvIds || myConvIds.length === 0) return null

  const ids = myConvIds.map(r => r.conversation_id)

  const { data: directConvs } = await supabase
    .from('chat_conversations')
    .select('id')
    .in('id', ids)
    .eq('is_group', false)

  if (!directConvs || directConvs.length === 0) return null

  const directIds = directConvs.map(c => c.id)

  const { data: otherParticipants } = await supabase
    .from('chat_participants')
    .select('conversation_id')
    .in('conversation_id', directIds)
    .eq('user_id', userB)

  if (!otherParticipants || otherParticipants.length === 0) return null

  return otherParticipants[0].conversation_id
}

export async function markAsRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getTotalUnreadCount(userId: string): Promise<number> {
  const { data: participantRows, error: pErr } = await supabase
    .from('chat_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)

  if (pErr || !participantRows || participantRows.length === 0) return 0

  const minLastReadAt = participantRows.reduce(
    (min, p) => (p.last_read_at < min ? p.last_read_at : min),
    participantRows[0].last_read_at
  )
  const conversationIds = participantRows.map(p => p.conversation_id)
  const lastReadByConv = new Map(participantRows.map(p => [p.conversation_id, p.last_read_at]))

  const { data: candidates, error: cErr } = await supabase
    .from('chat_messages')
    .select('conversation_id, created_at, sender_id')
    .in('conversation_id', conversationIds)
    .gt('created_at', minLastReadAt)
    .neq('sender_id', userId)

  if (cErr) throw cErr

  let total = 0
  for (const m of candidates || []) {
    const lastRead = lastReadByConv.get(m.conversation_id)
    if (lastRead && m.created_at > lastRead) total++
  }
  return total
}
