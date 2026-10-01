import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import hr from './locales/hr/translation.json'
import en from './locales/en/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      hr: { translation: hr },
      en: { translation: en },
    },
    fallbackLng: 'hr',
    // A Croatian browser with nothing stored makes the detector report 'hr-HR', which matches no
    // resource bundle and fails every `i18n.language === 'hr'` test in the app — those users got an
    // English calendar. `load: 'languageOnly'` strips the region before lookup, and `supportedLngs`
    // keeps anything else falling back to Croatian. See src/utils/locale.ts.
    supportedLngs: ['hr', 'en'],
    load: 'languageOnly',
    // Suppresses i18next's Locize promo console.info on every dev boot.
    showSupportNotice: false,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
