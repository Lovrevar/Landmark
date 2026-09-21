import { describe, it, expect } from 'vitest'
import { isCroatian, appLanguage, intlLocale } from './locale'

/**
 * The regional tag is the whole point: fourteen components tested `i18n.language === 'hr'`, which
 * is false for the `'hr-HR'` the language detector hands back for a Croatian browser with nothing
 * stored — so those users read an English UI.
 */
describe('isCroatian', () => {
  it('accepts the bare tag, the regional tag and odd casing', () => {
    expect(isCroatian('hr')).toBe(true)
    expect(isCroatian('hr-HR')).toBe(true)
    expect(isCroatian('HR')).toBe(true)
    expect(isCroatian('hr-BA')).toBe(true)
  })

  it('rejects other languages, including ones that merely contain "hr"', () => {
    expect(isCroatian('en')).toBe(false)
    expect(isCroatian('en-GB')).toBe(false)
    expect(isCroatian('de-CH')).toBe(false)
  })

  it('treats missing input as not Croatian, so callers fall back explicitly', () => {
    expect(isCroatian(undefined)).toBe(false)
    expect(isCroatian(null)).toBe(false)
    expect(isCroatian('')).toBe(false)
  })
})

describe('appLanguage', () => {
  it('maps Croatian and English tags to their language', () => {
    expect(appLanguage('hr-HR')).toBe('hr')
    expect(appLanguage('hr')).toBe('hr')
    expect(appLanguage('en-US')).toBe('en')
    expect(appLanguage('en')).toBe('en')
  })

  it('falls back to Croatian for anything else, as i18next does for the strings', () => {
    expect(appLanguage('de-CH')).toBe('hr')
    expect(appLanguage(undefined)).toBe('hr')
    expect(appLanguage('')).toBe('hr')
  })
})

describe('intlLocale', () => {
  it('gives a BCP-47 tag Intl accepts', () => {
    expect(intlLocale('hr')).toBe('hr-HR')
    expect(intlLocale('hr-HR')).toBe('hr-HR')
    expect(intlLocale('en')).toBe('en-US')
  })
})
