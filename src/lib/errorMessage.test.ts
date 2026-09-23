import { describe, expect, it } from 'vitest'
import { isPermissionError, toErrorMessage } from './errorMessage'

const FALLBACK = 'Spremanje nije uspjelo. Pokušajte ponovno.'

describe('isPermissionError', () => {
  it('recognises the Postgres insufficient_privilege code', () => {
    expect(isPermissionError({ code: '42501', message: 'permission denied' })).toBe(true)
  })

  it('is false for anything else', () => {
    expect(isPermissionError({ code: '23503' })).toBe(false)
    expect(isPermissionError(new Error('boom'))).toBe(false)
    expect(isPermissionError(null)).toBe(false)
    expect(isPermissionError(undefined)).toBe(false)
  })
})

describe('toErrorMessage', () => {
  it('keeps a message that was written for a person', () => {
    // Services throw these deliberately; they say more than any generic fallback could.
    const err = new Error('Ne možete obrisati faze koje imaju ugovore: Faza 2 (3).')
    expect(toErrorMessage(err, FALLBACK)).toBe('Ne možete obrisati faze koje imaju ugovore: Faza 2 (3).')
  })

  it('reads the message off a Supabase-shaped rejection', () => {
    expect(toErrorMessage({ message: 'Račun s tim brojem već postoji.' }, FALLBACK)).toBe(
      'Račun s tim brojem već postoji.',
    )
  })

  it('falls back when the error is machine text', () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy for table "tasks"' }
    expect(toErrorMessage(rls, FALLBACK)).toBe(FALLBACK)
    expect(toErrorMessage({ message: 'duplicate key value violates unique constraint "x"' }, FALLBACK)).toBe(FALLBACK)
    expect(toErrorMessage({ message: 'PGRST301' }, FALLBACK)).toBe(FALLBACK)
  })

  it('falls back when there is nothing to show', () => {
    expect(toErrorMessage(new Error(''), FALLBACK)).toBe(FALLBACK)
    expect(toErrorMessage(null, FALLBACK)).toBe(FALLBACK)
    expect(toErrorMessage(undefined, FALLBACK)).toBe(FALLBACK)
    expect(toErrorMessage('a bare string', FALLBACK)).toBe(FALLBACK)
  })
})
