// The voice clamps (docs/ASSISTANT_API.md, "Voice"): what a tool returns is cut
// to what a caller can take in by ear. Arrays keep their first five items and
// say how many there were; long free text is clipped. Ids stay: the assistant
// chains calls with them, and its own prompt keeps them from being read aloud.

export const VOICE_MAX_ITEMS = 5
export const VOICE_MAX_CHARS = 200

function clipString(s: string): string {
  return s.length > VOICE_MAX_CHARS ? `${s.slice(0, VOICE_MAX_CHARS)}…` : s
}

/** A copy of `value` clamped for voice. An array cut short gets its original
 * length beside it as `total`, or as `<key>_total` where `total` is taken or
 * one object holds several cut arrays. A cut top-level array becomes
 * `{ items, total }`. */
export function clampForVoice(value: unknown): unknown {
  if (typeof value === 'string') return clipString(value)
  if (Array.isArray(value)) {
    const items = value.slice(0, VOICE_MAX_ITEMS).map(clampForVoice)
    return value.length > VOICE_MAX_ITEMS ? { items, total: value.length } : items
  }
  if (value === null || typeof value !== 'object') return value

  const obj = value as Record<string, unknown>
  const cut = Object.keys(obj).filter((k) => Array.isArray(obj[k]) && (obj[k] as unknown[]).length > VOICE_MAX_ITEMS)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = Array.isArray(v) ? v.slice(0, VOICE_MAX_ITEMS).map(clampForVoice) : clampForVoice(v)
  }
  for (const k of cut) {
    const key = cut.length === 1 && !('total' in obj) ? 'total' : `${k}_total`
    out[key] = (obj[k] as unknown[]).length
  }
  return out
}
