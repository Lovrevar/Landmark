import { describe, it, expect } from 'vitest'
import { isChecklist, subtaskProgress } from './subtasks'
import type { Subtask, Task } from '../../types/tasks'

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

function task(subtasks?: Subtask[]): Task {
  return {
    id: 't1',
    title: 'Zadatak',
    description: '',
    created_by: 'u1',
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
    subtasks,
  }
}

describe('isChecklist', () => {
  // The two shapes a task arrives in before hydration has run, and after it has run on a
  // task with no lines. Both mean "simple task", and neither may disable a checkbox.
  it('treats undefined subtasks as a simple task', () => {
    expect(isChecklist(task(undefined))).toBe(false)
  })

  it('treats an empty list as a simple task', () => {
    expect(isChecklist(task([]))).toBe(false)
  })

  it('treats a single line as a checklist', () => {
    expect(isChecklist(task([subtask('a', false)]))).toBe(true)
  })

  it('stays a checklist when every line is done', () => {
    expect(isChecklist(task([subtask('a', true), subtask('b', true)]))).toBe(true)
  })
})

describe('subtaskProgress', () => {
  it('reports zero of zero for a simple task', () => {
    expect(subtaskProgress(task(undefined))).toEqual({ done: 0, total: 0 })
    expect(subtaskProgress(task([]))).toEqual({ done: 0, total: 0 })
  })

  it('counts only the completed lines', () => {
    const t = task([subtask('a', true), subtask('b', false), subtask('c', true)])
    expect(subtaskProgress(t)).toEqual({ done: 2, total: 3 })
  })

  it('reports a fully ticked checklist as done of total, not as zero', () => {
    const t = task([subtask('a', true), subtask('b', true)])
    expect(subtaskProgress(t)).toEqual({ done: 2, total: 2 })
  })
})
