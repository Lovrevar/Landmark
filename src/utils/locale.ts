/**
 * Which language the UI is in, asked once instead of fourteen times.
 *
 * Fourteen components carried `const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'`.
 * That test is **false for `'hr-HR'`**, which is exactly what the language detector produces for a
 * Croatian browser with nothing in localStorage (`detection.order: ['localStorage', 'navigator']`),
 * so those users read an English calendar in a Croatian app. `src/i18n.ts` now pins
 * `supportedLngs` + `load: 'languageOnly'` so the detector hands back a bare `'hr'`; these helpers
 * are the second line of defence, and the one place to change if a third language is ever added.
 *
 * `AppLanguage` is what the rest of the app switches on; `intlLocale` is the BCP-47 tag for `Intl`
 * and `toLocaleString`.
 */

export type AppLanguage = 'hr' | 'en'

/** True for 'hr', 'hr-HR', 'HR' — anything the detector may hand back for Croatian. */
export function isCroatian(language: string | null | undefined): boolean {
  return !!language && language.toLowerCase().startsWith('hr')
}

/**
 * The app language for any detector output.
 *
 * Mirrors i18next's own resolution: English for an English tag, Croatian for everything else,
 * including an unknown language or none at all — the same thing `supportedLngs` + `fallbackLng: 'hr'`
 * do to the strings on the same screen. Rendering a German browser's dates in English while its
 * labels came out Croatian is exactly the split this module exists to prevent.
 */
export function appLanguage(language: string | null | undefined): AppLanguage {
  return !!language && language.toLowerCase().startsWith('en') ? 'en' : 'hr'
}

/** BCP-47 tag for `Intl` / `toLocaleString` / `toLocaleTimeString`. */
export function intlLocale(language: string | null | undefined): string {
  return appLanguage(language) === 'hr' ? 'hr-HR' : 'en-US'
}
