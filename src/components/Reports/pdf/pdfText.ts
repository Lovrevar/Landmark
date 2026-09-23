import { formatEuro, formatEuroRounded, formatEuroCompact } from '../../../utils/formatters'

/**
 * Text helpers shared by every PDF generator.
 *
 * `winAnsi` existed in three copies and was missing from the two generators that needed it most:
 * `investmentReportPdf` printed `Available: €−12.345` on an over-utilised credit and
 * `debtExport` printed a negative remaining balance, and in both the whole line rendered as noise.
 *
 * Why a minus sign does that: jsPDF's built-in fonts are WinAnsi, which has no U+2212, and one
 * unmapped character makes jsPDF re-encode the *entire string* as UCS-2BE. The generators now embed
 * Noto Sans (see `src/utils/pdfFont.ts`), which does have U+2212 — so this is belt and braces
 * rather than the only line of defence. It costs one `replace` and an ASCII hyphen reads correctly
 * in Croatian, so it stays: the day someone adds a generator and forgets the font, a number is
 * still a number.
 */
export const winAnsi = (text: string): string => text.replace(/−/g, '-')

/** Exact cents — per-record amounts (an invoice, a payment, a contract). */
export const pdfMoney = (value: number | null | undefined): string => winAnsi(formatEuro(value))

/** Whole euros — the aggregate figures a report is mostly made of. */
export const pdfMoneyRounded = (value: number | null | undefined): string =>
  winAnsi(formatEuroRounded(value))

/** Abbreviated (€1,2M / €45K) — KPI boxes and chart axes, where a full figure does not fit. */
export const pdfMoneyCompact = (value: number | null | undefined): string =>
  winAnsi(formatEuroCompact(value))
