import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const isHr = i18n.language === 'hr' || i18n.language.startsWith('hr-')

  return (
    <button
      onClick={() => i18n.changeLanguage(isHr ? 'en' : 'hr')}
      className="
        inline-flex items-center justify-center
        w-8 h-8
        text-xs font-semibold tracking-wide
        text-gray-600 dark:text-gray-300
        bg-white dark:bg-gray-800
        border border-transparent rounded-md
        hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-white
        active:bg-gray-100 dark:active:bg-gray-700
        transition-all duration-150
        cursor-pointer
        select-none
      "
    >
      {isHr ? 'EN' : 'HR'}
    </button>
  )
}
