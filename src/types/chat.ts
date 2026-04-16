export interface ChatUser {
  id: string
  username: string
  role: string
}

export interface ChatConversation {
  id: string
  name: string | null
  is_group: boolean
  created_by: string
  created_at: string
  participants: ChatParticipant[]
  last_message?: ChatMessage | null
  unread_count: number
}

export interface ChatParticipant {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
  user?: ChatUser
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: ChatUser
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
  file_type?: string | null
}
