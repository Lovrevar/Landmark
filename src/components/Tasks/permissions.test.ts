import { describe, it, expect } from 'vitest'
import { canEditTask, completionToggle } from './permissions'
import type { Subtask, Task, TaskAssignee } from '../../types/tasks'

function assignee(userId: string): TaskAssignee {
  return {
    id: `a-${userId}`,
    task_id: 't1',
    assignee_id: userId,
    acknowledged_at: null,
    created_at: '2026-09-02T09:00:00Z',
  }
}

function subtask(id: string, completed: boolean): Subtask {
  return {
    id,
    task_id: 't1',
    title: id,
    position: 0,
    completed,
    completed_at: completed ? '2026-09-02T10:00:00Z' : null,
    created_at: '2026-09-02T09:00:00Z',
  }
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Zadatak',
    description: '',
    created_by: 'creator',
    deadline: null,
    due_time: null,
    completed: false,
    is_private: false,
    project_id: null,
    color: null,
    description_format: 'plain',
    completed_at: null,
    created_at: '2026-09-02T09:00:00Z',
    updated_at: '2026-09-02T09:00:00Z',
    assignees: [assignee('helper')],
    ...overrides,
  }
}

// Echoes the key and its values, so assertions can see which message was chosen.
const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key

describe('canEditTask', () => {
  it('lets the creator and assignees edit', () => {
    expect(canEditTask(task(), 'creator')).toBe(true)
    expect(canEditTask(task(), 'helper')).toBe(true)
  })

  it('refuses anyone else, and a missing user', () => {
    expect(canEditTask(task(), 'bystander')).toBe(false)
    expect(canEditTask(task(), null)).toBe(false)
    expect(canEditTask(task({ assignees: undefined }), 'helper')).toBe(false)
  })
})

describe('completionToggle', () => {
  it('is live for an editor, labelled with the action it performs', () => {
    expect(completionToggle(task(), 'helper', t)).toEqual({ disabled: false, title: 'tasks.row.mark_done' })
    expect(completionToggle(task({ completed: true }), 'helper', t)).toEqual({
      disabled: false,
      title: 'tasks.row.mark_open',
    })
  })

  it('is read-only for someone who cannot edit the task', () => {
    expect(completionToggle(task(), 'bystander', t)).toEqual({ disabled: true, title: 'tasks.row.read_only' })
  })

  it('follows the subtasks on a checklist, even for the creator', () => {
    const checklist = task({ subtasks: [subtask('s1', true), subtask('s2', false)] })
    expect(completionToggle(checklist, 'creator', t)).toEqual({
      disabled: true,
      title: 'tasks.subtasks.governed_tooltip {"done":1,"total":2}',
    })
  })
})
