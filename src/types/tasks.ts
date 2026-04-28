export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskDescriptionFormat = 'markdown' | 'plain'

export interface TaskUser {
  id: string
  username: string
  role: string
}

export interface TaskAssignee {
  id: string
  task_id: string
  user_id: string
  acknowledged_at: string | null
  created_at: string
  user?: TaskUser
}

export interface TaskAttachment {
  id: string
  task_id: string
  uploaded_by: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number
  created_at: string
  uploader?: TaskUser
}

export interface Task {
  id: string
  title: string
  description: string
  created_by: string
  due_date: string | null
  due_time: string | null
  status: TaskStatus
  priority: TaskPriority
  is_private: boolean
  project_id: string | null
  reminder_offsets: number[]
  description_format: TaskDescriptionFormat
  completed_at: string | null
  created_at: string
  updated_at: string
  creator?: TaskUser
  assignees?: TaskAssignee[]
  attachments?: TaskAttachment[]
  comment_count?: number
}

export type EventType = 'meeting' | 'personal' | 'deadline' | 'reminder'
export type EventResponse = 'pending' | 'accepted' | 'declined'

export interface EventParticipant {
  id: string
  event_id: string
  user_id: string
  response: EventResponse
  acknowledged_at: string | null
  created_at: string
  user?: TaskUser
}

export interface EventException {
  id: string
  event_id: string
  original_start_at: string
  override_start_at: string | null
  override_end_at: string | null
  override_title: string | null
  is_cancelled: boolean
  created_at: string
}

export interface OccurrenceResponse {
  id: string
  event_id: string
  user_id: string
  original_start_at: string
  response: EventResponse
  acknowledged_at: string
  created_at: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  location: string
  created_by: string
  start_at: string
  end_at: string
  event_type: EventType
  is_private: boolean
  all_day: boolean
  project_id: string | null
  recurrence: string | null
  reminder_offsets: number[]
  busy: boolean
  created_at: string
  updated_at: string
  creator?: TaskUser
  participants?: EventParticipant[]
  exceptions?: EventException[]
  occurrence_responses?: OccurrenceResponse[]
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  comment: string
  created_at: string
  updated_at: string
  user?: TaskUser
}

export interface NewTaskInput {
  title: string
  description: string
  due_date: string | null
  due_time: string | null
  priority: TaskPriority
  status: TaskStatus
  is_private: boolean
  project_id: string | null
  reminder_offsets: number[]
  description_format: TaskDescriptionFormat
  assignee_ids: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  due_date?: string | null
  due_time?: string | null
  priority?: TaskPriority
  status?: TaskStatus
  is_private?: boolean
  project_id?: string | null
  reminder_offsets?: number[]
  description_format?: TaskDescriptionFormat
}

export interface NewEventInput {
  title: string
  description: string
  location: string
  start_at: string
  end_at: string
  event_type: EventType
  is_private: boolean
  all_day: boolean
  participant_ids: string[]
  project_id: string | null
  recurrence: string | null
  reminder_offsets: number[]
  busy: boolean
}
