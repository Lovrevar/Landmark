export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

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
  completed_at: string | null
  created_at: string
  updated_at: string
  creator?: TaskUser
  assignees?: TaskAssignee[]
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
  created_at: string
  updated_at: string
  creator?: TaskUser
  participants?: EventParticipant[]
}

export interface NewTaskInput {
  title: string
  description: string
  due_date: string | null
  due_time: string | null
  priority: TaskPriority
  is_private: boolean
  assignee_ids: string[]
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
}
