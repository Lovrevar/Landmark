import i18n from '../i18n'
import type { TFunction } from 'i18next'

/**
 * The language exported documents are written in: **always Croatian**, whatever the UI is set to.
 *
 * These files go to banks, investors and the accountant, and the recipient's language has nothing
 * to do with whichever language the person clicking Export happens to be reading the app in.
 * `docs/REPORTS.md` records the decision.
 *
 * Exports still read the same locale files as the screens — about two thirds of the labels a report
 * needs were already translated for the equivalent screen — so this is a fixed-language translator
 * rather than a second set of hard-coded strings. (`retailReportPdf` used to hard-code its
 * Croatian, which is why none of it could be reused anywhere.)
 */
export const EXPORT_LANGUAGE = 'hr'

/** A `t` pinned to Croatian, for a generator to use instead of the caller's `t`. */
export const exportT = (): TFunction => i18n.getFixedT(EXPORT_LANGUAGE)
