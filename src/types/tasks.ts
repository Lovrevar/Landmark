export type TaskDescriptionFormat = 'markdown' | 'plain'

/**
 * User ids in the task tables are AUTH user ids (auth.users / profiles),
 * not public.users ids — the schema is shared with the standalone mobile
 * task app. TaskUser.id therefore holds users.auth_user_id.
 */
export interface TaskUser {
  id: string
  username: string
  role: string
}

/**
 * The acting user for task mutations. `auth_user_id` is written into the
 * task tables; `id` (public.users id) + `role` feed the activity log.
 * The AuthContext user object satisfies this shape.
 */
export interface TaskActor {
  id: string
  auth_user_id: string
  role: string
}

export interface TaskAssignee {
  id: string
  task_id: string
  assignee_id: string
  acknowledged_at: string | null
  created_at: string
  user?: TaskUser
}

export interface TaskAttachment {
  id: string
  task_id: string
  uploaded_by: string | null
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
  created_by: string | null
  deadline: string | null
  due_time: string | null
  completed: boolean
  is_private: boolean
  project_id: string | null
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
  deadline: string | null
  is_private: boolean
  project_id: string | null
  /** auth user ids */
  assignee_ids: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  deadline?: string | null
  due_time?: string | null
  completed?: boolean
  is_private?: boolean
  project_id?: string | null
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
