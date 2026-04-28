# Module: Chat

**Path:** `src/components/Chat/`

## Overview

1:1 and group conversations between authenticated users with text + file attachments, unread tracking, and a global header badge that updates instantly via Supabase Realtime.

---

## Data Layer

Three tables: `chat_conversations`, `chat_participants` (junction with `last_read_at`), `chat_messages` (optional `file_url`/`file_name`/`file_size`/`file_type`). File attachments are stored in the `chat-attachments` Supabase storage bucket.

### services/chatService.ts
- `fetchAllUsers()` — list of all users for the new-conversation picker
- `fetchConversations(userId)` — conversations the user participates in, hydrated with participants, last message, and per-conversation unread count (counts messages newer than `last_read_at`, excluding own messages)
- `fetchMessages(conversationId, limit?, offset?)` — paginated messages for a conversation, hydrated with sender data
- `uploadChatFile(file, conversationId)` — uploads to `chat-attachments` bucket, enforces 25 MB limit (throws `FILE_TOO_LARGE`), returns public URL + metadata
- `sendMessage(conversationId, senderId, content, attachment?)` — inserts a message row
- `createConversation(creatorId, participantIds, name, isGroup)` — for 1:1, reuses the existing direct conversation if one exists between the two users; for group, creates new
- `findExistingDirectConversation(userA, userB)` — internal helper used by `createConversation` to avoid duplicate 1:1 conversations
- `markAsRead(conversationId, userId)` — updates `last_read_at` for the participant row
- `getTotalUnreadCount(userId)` — sums unread messages across all conversations for the global badge
- **Depends on:** supabase client, activityLog
- **Logs:** `conversation.create` (medium)

---

## Hooks

### hooks/useChat.ts
- `useChat()` — owns conversations list, active conversation state, messages, and Supabase Realtime subscription on `chat_messages` INSERT (channel `chat-messages-realtime`)
- On every realtime payload: enriches the message with sender data, appends to messages if it belongs to the active conversation, increments unread on the conversation, and re-sorts conversations by recency
- Polls active-conversation messages every 3 s as a safety net for missed realtime events
- Auto-marks the active conversation as read when messages from others arrive, dispatches `chat:marked-read`
- Dispatches `chat:unread-update` with the new total whenever conversations change
- **Calls:** chatService.ts
- **Returns:** conversations, activeConversation, activeConversationId, messages, loadingConversations, loadingMessages, sendingMessage, selectConversation, sendMessage, createConversation, refreshConversations
- **Mounted in:** [Chat/index.tsx](../src/components/Chat/index.tsx) only

### hooks/useChatNotifications.ts
- `useChatNotifications()` — powers the global red badge on the chat icon in [Layout.tsx](../src/components/Common/Layout.tsx)
- Subscribes to `chat_messages` INSERT events on a separate Realtime channel (`chat-notifications-realtime`) with server-side filter `sender_id=neq.${user.id}` so own messages never wake the listener; refreshes the count on every event
- Falls back to a 60 s reconciliation poll for any missed websocket events
- Listens for `chat:marked-read` and `chat:unread-update` window events for in-Chat-page synchronization
- Exports module-level `dispatchChatRead()` and `dispatchUnreadCount(count)` helpers used by `useChat`
- **Calls:** chatService.getTotalUnreadCount
- **Returns:** unreadCount, refresh
- **Mounted in:** [Layout.tsx](../src/components/Common/Layout.tsx) (global, every authenticated screen)

---

## Views

### index.tsx (ChatPage)
- Two-pane layout: conversation list on the left, message panel on the right; mobile toggles between the two
- **Uses hooks:** useChat
- **Uses components:** ConversationList, MessagePanel, NewConversationModal

### ConversationList.tsx
- Sidebar list of conversations with last-message preview, unread badge, and search
- Shows relative time ("now") for messages within 60 s, otherwise locale-aware short time/date

### MessagePanel.tsx
- Header with conversation name + participant count, message thread, and composer (textarea + file attach + send)
- Surfaces the `FILE_TOO_LARGE` sentinel error from `uploadChatFile` with an i18n'd toast

### MessageBubble.tsx
- Single message bubble with sender, timestamp, and optional file attachment preview
- Renders date separators ("Today" / "Yesterday" / locale date) between message clusters

### NewConversationModal.tsx
- Picker for creating a new 1:1 or group conversation; multi-select user list with optional group name

---

## Realtime Architecture

Two distinct Supabase Realtime channels are used. They MUST have different names — reusing the same channel name across hooks causes one to silently overwrite the other when both are mounted simultaneously.

| Channel | Owner | Scope |
|---|---|---|
| `chat-messages-realtime` | `useChat` | Messages for the open chat thread; only mounted on `/chat` |
| `chat-notifications-realtime` | `useChatNotifications` | Global unread badge; mounted everywhere via Layout |

---

## Notes
- Activity logging is intentionally limited to `conversation.create` — message sends are not logged to keep the audit trail noise-free
- File size limit (25 MB) is enforced client-side in `uploadChatFile` and surfaces as a translated error
- `last_read_at` on `chat_participants` is the source of truth for unread counts; both per-conversation and global counts are computed from it
