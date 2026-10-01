import { describe, it, expect } from 'vitest'
import { classifyImportOutcome, importErrorMessage } from './importOutcome'

describe('classifyImportOutcome', () => {
  it('reports nothing imported when no row succeeded, even with no failures', () => {
    expect(classifyImportOutcome(0, 5)).toBe('nothing_imported')
    expect(classifyImportOutcome(0, 0)).toBe('nothing_imported')
  })

  it('reports a partial import when some rows succeeded and some failed', () => {
    expect(classifyImportOutcome(3, 1)).toBe('partial')
  })

  it('reports success only when every row succeeded', () => {
    expect(classifyImportOutcome(4, 0)).toBe('success')
  })
})

describe('importErrorMessage', () => {
  it('reads the message of an Error', () => {
    expect(importErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('reads the message of a plain Supabase error object', () => {
    expect(importErrorMessage({ message: 'duplicate key value', code: '23505' })).toBe('duplicate key value')
  })

  it('falls back to String() for anything else', () => {
    expect(importErrorMessage('bad row')).toBe('bad row')
    expect(importErrorMessage({ code: '23505' })).toBe('[object Object]')
  })
})
