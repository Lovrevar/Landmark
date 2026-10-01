/**
 * Hand a blob to the browser as a download.
 *
 * Nine call sites built this by hand and six of them got it wrong the same two ways: they never
 * appended the anchor to the document (a detached `<a>.click()` is unreliable in Firefox and in
 * embedded WebViews) and never called `revokeObjectURL`, so every export leaked its whole file in
 * memory until the tab closed. The two that were correct were copies of each other.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * `prefix-2026-09-23.xlsx`, the naming every export now follows.
 *
 * ASCII only, deliberately: a name is picked by the Croatian UI but lands in a Downloads folder, on
 * a shared drive or in an email, and `č`/`đ` survive none of those reliably. One export already
 * stripped non-ASCII from its filename while another left it in — this is the single answer.
 * The date is ISO so the files sort chronologically in a folder listing.
 */
export function exportFileName(prefix: string, extension: string, on: Date = new Date()): string {
  const stamp = [
    on.getFullYear(),
    String(on.getMonth() + 1).padStart(2, '0'),
    String(on.getDate()).padStart(2, '0'),
  ].join('-')
  return `${asciiSlug(prefix)}-${stamp}.${extension}`
}

/** Croatian letters folded to their ASCII base, everything else to a hyphen. */
export function asciiSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip the combining accents NFD just split off
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
