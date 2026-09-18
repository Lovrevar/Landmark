import { describe, it, expect } from 'vitest'
import { hasUnreadAssignment, markAssignmentRead } from './unread'
import type { Task, TaskAssignee } from '../../types/tasks'

const READ_AT = '2026-09-18T08:00:00Z'

function assignee(userId: string, acknowledgedAt: string | null = null): TaskAssignee {
  return {
    id: `a-${userId}`,
    task_id: 't1',
    assignee_id: userId,
    acknowledged_at: acknowledgedAt,
    created_at: '2026-09-02T09:00:00Z',
  }
}

function task(assignees: TaskAssignee[] | undefined): Pick<Task, 'id' | 'assignees'> {
  return { id: 't1', assignees }
}

describe('hasUnreadAssignment', () => {
  it('is true for an assignee who has not opened the task', () => {
    expect(hasUnreadAssignment(task([assignee('me')]), 'me')).toBe(true)
  })

  it('is false once they have', () => {
    expect(hasUnreadAssignment(task([assignee('me', READ_AT)]), 'me')).toBe(false)
  })

  it("is false for someone else's unread assignment", () => {
    expect(hasUnreadAssignment(task([assignee('other')]), 'me')).toBe(false)
  })

  it('is false with no assignees or no user', () => {
    expect(hasUnreadAssignment(task(undefined), 'me')).toBe(false)
    expect(hasUnreadAssignment(task([]), 'me')).toBe(false)
    expect(hasUnreadAssignment(task([assignee('me')]), null)).toBe(false)
    expect(hasUnreadAssignment(task([assignee('me')]), undefined)).toBe(false)
  })
})

describe('markAssignmentRead', () => {
  it("stamps only the user's own row", () => {
    const before = task([assignee('me'), assignee('other')])
    const after = markAssignmentRead(before, 'me', READ_AT)
    expect(after.assignees?.map(a => [a.assignee_id, a.acknowledged_at])).toEqual([
      ['me', READ_AT],
      ['other', null],
    ])
    expect(hasUnreadAssignment(after, 'me')).toBe(false)
  })

  it('does not mutate the task it was given', () => {
    const before = task([assignee('me')])
    markAssignmentRead(before, 'me', READ_AT)
    expect(before.assignees?.[0].acknowledged_at).toBeNull()
  })

  it('returns the same object when there is nothing to mark', () => {
    const read = task([assignee('me', '2026-09-01T00:00:00Z')])
    expect(markAssignmentRead(read, 'me', READ_AT)).toBe(read)
    const notMine = task([assignee('other')])
    expect(markAssignmentRead(notMine, 'me', READ_AT)).toBe(notMine)
  })

  it('keeps an earlier read time rather than moving it', () => {
    const earlier = '2026-09-01T00:00:00Z'
    const after = markAssignmentRead(task([assignee('me', earlier)]), 'me', READ_AT)
    expect(after.assignees?.[0].acknowledged_at).toBe(earlier)
  })
})
