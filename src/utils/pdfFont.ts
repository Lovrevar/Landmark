import type jsPDF from 'jspdf'

// Loads NotoSans from Google Fonts so jsPDF output renders Croatian
// characters (š č ć đ ž). Registers the family as 'NotoSans' with both a
// 'normal' and a 'bold' face. Throws if the fetch fails (offline, firewall,
// etc.) — callers catch and fall back to the built-in 'helvetica', which
// mangles the Croatian diacritics but keeps generation working.
export async function loadUnicodeFont(doc: jsPDF): Promise<void> {
  const toBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }
  const [regularRes, boldRes] = await Promise.all([
    fetch('https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf'),
    fetch('https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAaBN9d.ttf'),
  ])
  if (!regularRes.ok || !boldRes.ok) throw new Error('Font fetch failed')
  const [regularBuffer, boldBuffer] = await Promise.all([
    regularRes.arrayBuffer(),
    boldRes.arrayBuffer(),
  ])
  doc.addFileToVFS('NotoSans-Regular.ttf', toBase64(regularBuffer))
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', toBase64(boldBuffer))
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
}
