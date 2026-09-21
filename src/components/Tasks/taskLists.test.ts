import { describe, expect, it } from 'vitest'
import type { Task } from '../../types/tasks'
import {
  emptyListReason,
  filterTasks,
  isHiddenByShowCompleted,
  matchesSearch,
  partitionTasks,
  tabCount,
} from './taskLists'

const ME = 'auth-me'
const OTHER = 'auth-other'

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'Task',
    description: '',
    created_by: OTHER,
    deadline: null,
    due_time: null,
    completed: false,
    is_private: false,
    project_id: null,
    color: null,
    description_format: 'plain',
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Task
}

function assignedTo(id: string, userId: string): Task {
  return task({
    id,
    assignees: [
      {
        id: `a-${id}`,
        task_id: id,
        assignee_id: userId,
        acknowledged_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  } as Partial<Task> & { id: string })
}

describe('partitionTasks', () => {
  it('keeps a private task out of every tab but its creator\'s Private tab', () => {
    const mine = task({ id: 'p1', is_private: true, created_by: ME })
    const theirs = task({ id: 'p2', is_private: true, created_by: OTHER })
    const buckets = partitionTasks([mine, theirs], ME)

    expect(buckets.privateTasks.map(t => t.id)).toEqual(['p1'])
    expect(buckets.all).toHaveLength(0)
    expect(buckets.created).toHaveLength(0)
    expect(buckets.assigned).toHaveLength(0)
  })

  it('puts a task in both Created and Assigned when the user is both', () => {
    const t1 = assignedTo('t1', ME)
    t1.created_by = ME
    const buckets = partitionTasks([t1], ME)

    expect(buckets.all.map(t => t.id)).toEqual(['t1'])
    expect(buckets.created.map(t => t.id)).toEqual(['t1'])
    expect(buckets.assigned.map(t => t.id)).toEqual(['t1'])
  })

  it('returns empty buckets without a signed-in user', () => {
    const buckets = partitionTasks([task({ id: 't1' })], undefined)
    expect(buckets).toEqual({ all: [], assigned: [], created: [], privateTasks: [] })
  })
})

describe('isHiddenByShowCompleted', () => {
  it('hides a completed task only while the toggle is off', () => {
    const done = task({ id: 'd', completed: true })
    const open = task({ id: 'o' })
    expect(isHiddenByShowCompleted(done, false)).toBe(true)
    expect(isHiddenByShowCompleted(done, true)).toBe(false)
    expect(isHiddenByShowCompleted(open, false)).toBe(false)
  })
})

describe('matchesSearch', () => {
  const t1 = task({ id: 't1', title: 'Pregled gradilišta', description: 'Zapisnik' })

  it('matches title and description, case-insensitively', () => {
    expect(matchesSearch(t1, 'GRADILIŠTA')).toBe(true)
    expect(matchesSearch(t1, 'zapis')).toBe(true)
    expect(matchesSearch(t1, 'faktura')).toBe(false)
  })

  it('matches everything for a blank or whitespace query', () => {
    expect(matchesSearch(t1, '')).toBe(true)
    expect(matchesSearch(t1, '   ')).toBe(true)
  })
})

describe('tabCount', () => {
  const list = [
    task({ id: 'a' }),
    task({ id: 'b', completed: true }),
    task({ id: 'c', completed: true }),
  ]

  it('counts everything while completed tasks are shown', () => {
    expect(tabCount(list, true)).toBe(3)
  })

  it('counts only what the list shows while they are hidden', () => {
    expect(tabCount(list, false)).toBe(1)
  })

  it('always equals the length of the list rendered for an empty search', () => {
    for (const showCompleted of [true, false]) {
      expect(tabCount(list, showCompleted)).toBe(
        filterTasks(list, { showCompleted, search: '' }).length,
      )
    }
  })

  it('ignores the search box, which is transient', () => {
    expect(tabCount(list, true)).toBe(3)
    expect(filterTasks(list, { showCompleted: true, search: 'nothing matches' })).toHaveLength(0)
  })
})

describe('filterTasks', () => {
  it('applies both the toggle and the search', () => {
    const list = [
      task({ id: 'a', title: 'Alfa' }),
      task({ id: 'b', title: 'Alfa', completed: true }),
      task({ id: 'c', title: 'Beta' }),
    ]
    expect(filterTasks(list, { showCompleted: false, search: 'alfa' }).map(t => t.id)).toEqual(['a'])
    expect(filterTasks(list, { showCompleted: true, search: 'alfa' }).map(t => t.id)).toEqual(['a', 'b'])
  })
})

describe('emptyListReason', () => {
  const done = [task({ id: 'a', completed: true }), task({ id: 'b', completed: true })]

  it('is null while the list has something to show', () => {
    expect(emptyListReason(done, { showCompleted: true, search: '' })).toBeNull()
  })

  it('reports an empty category', () => {
    expect(emptyListReason([], { showCompleted: true, search: '' })).toBe('none')
  })

  it('reports tasks hidden by the "show completed" toggle', () => {
    expect(emptyListReason(done, { showCompleted: false, search: '' })).toBe('hidden_completed')
  })

  it('reports a search that matched nothing', () => {
    expect(emptyListReason(done, { showCompleted: true, search: 'zzz' })).toBe('no_search_match')
  })

  it('prefers the toggle explanation when both would apply', () => {
    expect(emptyListReason(done, { showCompleted: false, search: 'zzz' })).toBe('hidden_completed')
  })
})
