import { describe, it, expect } from 'vitest'
import { isAppPath } from './appPath'

/**
 * MarkdownView renders task descriptions and AI chat replies, so its links are not trusted.
 * An address the browser resolves to another host must never become a router `<Link>`.
 */
describe('isAppPath', () => {
  it('accepts the app routes and files that markdown links to', () => {
    expect(isAppPath('/help/tasks')).toBe(true)
    expect(isAppPath('/help/tasks#comments')).toBe(true)
    expect(isAppPath('/projects?tab=budget')).toBe(true)
    expect(isAppPath('/help-kb/img/tasks.png')).toBe(true)
  })

  it('rejects other sites and relative or missing addresses', () => {
    expect(isAppPath('https://evil.com/')).toBe(false)
    expect(isAppPath('//evil.com')).toBe(false)
    expect(isAppPath('javascript:alert(1)')).toBe(false)
    expect(isAppPath('help/tasks')).toBe(false)
    expect(isAppPath('')).toBe(false)
    expect(isAppPath(undefined)).toBe(false)
  })

  it('SEC-A13: rejects addresses a browser reads as "//host"', () => {
    expect(isAppPath('/\\evil.com')).toBe(false)
    expect(isAppPath('/\\/evil.com')).toBe(false)
    expect(isAppPath('/\t/evil.com')).toBe(false)
    expect(isAppPath('/\n/evil.com')).toBe(false)
  })
})
