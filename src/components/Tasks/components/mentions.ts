export function renderCommentWithMentions(
  comment: string,
): Array<{ type: 'text' | 'mention'; value: string; userId?: string }> {
  const re = /@\[([^\]]+)\]\(([^)]+)\)/g
  const out: Array<{ type: 'text' | 'mention'; value: string; userId?: string }> = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(comment)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: comment.slice(last, m.index) })
    out.push({ type: 'mention', value: m[1], userId: m[2] })
    last = m.index + m[0].length
  }
  if (last < comment.length) out.push({ type: 'text', value: comment.slice(last) })
  return out
}
