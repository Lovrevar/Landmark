import { describe, it, expect } from 'vitest'
import { chatAttachmentPath } from './chatService'

describe('chatAttachmentPath', () => {
  it('returns a stored path unchanged', () => {
    expect(chatAttachmentPath('c1/1700000000000_ab12cd34.pdf')).toBe('c1/1700000000000_ab12cd34.pdf')
  })

  it('extracts the path from a public URL written before the bucket went private', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/chat-attachments/c1/1700000000000_ab12cd34.pdf'
    expect(chatAttachmentPath(url)).toBe('c1/1700000000000_ab12cd34.pdf')
  })

  it('decodes escaped characters and drops a query string', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/chat-attachments/c1/a%20b.png?t=1'
    expect(chatAttachmentPath(url)).toBe('c1/a b.png')
  })
})
