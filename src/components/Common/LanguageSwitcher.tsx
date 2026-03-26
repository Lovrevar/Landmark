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
        text-gray-600
        bg-white
        border border-transparent rounded-md
        hover:border-gray-400 hover:text-gray-800
        active:bg-gray-100
        transition-all duration-150
        cursor-pointer
        select-none
      "
    >
      {isHr ? 'EN' : 'HR'}
    </button>
  )
}
