import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import type { ChatConversation, ChatMessage, ChatUser } from '../../../types/chat'

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

export async function fetchConversations(userId: string): Promise<ChatConversation[]> {
  const { data: participantRows, error: pErr } = await supabase
    .from('chat_participants')
    .select('conversation_id')
    .eq('user_id', userId)

  if (pErr) throw pErr
  if (!participantRows || participantRows.length === 0) return []

  const conversationIds = participantRows.map(p => p.conversation_id)

  const { data: conversations, error: cErr } = await supabase
    .from('chat_conversations')
    .select('id, name, is_group, created_by, created_at')
    .in('id', conversationIds)
    .order('created_at', { ascending: false })

  if (cErr) throw cErr
  if (!conversations) return []

  const { data: allParticipants, error: apErr } = await supabase
    .from('chat_participants')
    .select('id, conversation_id, user_id, joined_at, last_read_at')
    .in('conversation_id', conversationIds)

  if (apErr) throw apErr

  const participantUserIds = [...new Set((allParticipants || []).map(p => p.user_id))]
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, username, role')
    .in('id', participantUserIds)

  if (uErr) throw uErr

  const userMap = new Map((users || []).map(u => [u.id, u]))

  const result: ChatConversation[] = []

  for (const conv of conversations) {
    const participants = (allParticipants || [])
      .filter(p => p.conversation_id === conv.id)
      .map(p => ({
        ...p,
        user: userMap.get(p.user_id) || undefined,
      }))

    const myParticipant = participants.find(p => p.user_id === userId)

    const { data: lastMsg } = await supabase
      .from('chat_messages')
      .select(MSG_FIELDS)
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let unreadCount = 0
    if (myParticipant) {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .gt('created_at', myParticipant.last_read_at)
        .neq('sender_id', userId)

      unreadCount = count || 0
    }

    const lastMessage = lastMsg
      ? { ...lastMsg, sender: userMap.get(lastMsg.sender_id) || undefined }
      : null

    result.push({
      ...conv,
      participants,
      last_message: lastMessage,
      unread_count: unreadCount,
    })
  }

  result.sort((a, b) => {
    const aTime = a.last_message?.created_at || a.created_at
    const bTime = b.last_message?.created_at || b.created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return result
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

  let total = 0
  for (const p of participantRows) {
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', p.conversation_id)
      .gt('created_at', p.last_read_at)
      .neq('sender_id', userId)

    total += count || 0
  }

  return total
}
