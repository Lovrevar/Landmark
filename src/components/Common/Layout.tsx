import React, { ReactNode, Suspense, useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Profile } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { useModalOverflow } from '../../hooks/useModalOverflow'
import {
  Building2,
  LogOut,
  BarChart3,
  Calculator,
  Home,
  Users,
  Calendar,
  DollarSign,
  ChevronDown,
  User,
  ClipboardCheck,
  TrendingUp,
  FileText,
  FolderKanban,
  CreditCard,
  Lock,
  AlertCircle,
  MapPin,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Sun,
  Moon,
  ScrollText,
  MessageCircle,
  CheckSquare,
  Files,
  Menu as MenuIcon,
  X
} from 'lucide-react'
import { canViewActivityLog } from '../../utils/permissions'
import Input from '../ui/Input'
import { useChatNotifications } from '../Chat/hooks/useChatNotifications'
import { useTasksNotifications } from '../Tasks/hooks/useTasksNotifications'
import AiChatWidget from '../AiChat/AiChatWidget'
import { useCalendarNotifications } from '../Calendar/hooks/useCalendarNotifications'
import PageFallback from './PageFallback'

interface LayoutProps {
  children: ReactNode
}

const configuredCashflowPassword = (import.meta.env.VITE_CASHFLOW_PASSWORD ?? '').trim()
const cashflowConfigured = configuredCashflowPassword.length > 0

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation()
  const { currentProfile, setCurrentProfile, logout, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const isDesktop = useIsDesktop()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null)
  const [cashflowUnlocked, setCashflowUnlocked] = useState(() => sessionStorage.getItem('cashflow_unlocked') === 'true')
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { unreadCount } = useChatNotifications()
  const { unreadCount: taskUnread } = useTasksNotifications()
  const { unreadCount: eventUnread } = useCalendarNotifications()

  // Below lg the sidebar is a full-width drawer; the collapsed (w-16) state only applies to desktop.
  const sidebarExpanded = !isDesktop || sidebarOpen

  // Lock background scroll while the mobile nav drawer is open.
  useModalOverflow(mobileNavOpen)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false)
      }
    }
    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileDropdown])

  useEffect(() => {
    if (currentProfile === 'Cashflow' && !cashflowUnlocked) {
      setPendingProfile('Cashflow')
      setShowPasswordModal(true)
    }
  }, [currentProfile, cashflowUnlocked])

  const getMenuItems = () => {
    if (user?.role === 'Supervision') {
      return [
        { name: t('nav.site_management'), icon: Building2, path: '/site-management' },
        { name: t('nav.work_logs'), icon: ClipboardCheck, path: '/work-logs' },
        { name: t('nav.payments'), icon: DollarSign, path: '/payments' },
        { name: t('nav.invoices'), icon: FileText, path: '/invoices' },
        { name: t('nav.documents'), icon: Files, path: '/documents' }
      ]
    }

    const menuConfig = {
      General: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.projects'), icon: FolderKanban, path: '/projects' },
        { name: t('nav.budget_control'), icon: TrendingUp, path: '/budget-control' },
        { name: t('nav.documents'), icon: Files, path: '/documents' },
        { name: t('nav.reports'), icon: FileText, path: '/general-reports' },
        ...(canViewActivityLog(user) ? [{ name: t('nav.activity_log'), icon: ScrollText, path: '/activity-log' }] : []),
      ],
      Supervision: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.site_management'), icon: Building2, path: '/site-management' },
        { name: t('nav.subcontractors'), icon: Users, path: '/subcontractors' },
        { name: t('nav.work_logs'), icon: ClipboardCheck, path: '/work-logs' },
        { name: t('nav.payments'), icon: DollarSign, path: '/payments' },
        { name: t('nav.invoices'), icon: FileText, path: '/invoices' },
        { name: t('nav.documents'), icon: Files, path: '/documents' }
      ],
      Sales: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.apartments'), icon: Home, path: '/apartments' },
        { name: t('nav.sales_projects'), icon: Building2, path: '/sales-projects' },
        { name: t('nav.customers'), icon: Users, path: '/customers' },
        { name: t('nav.payments'), icon: DollarSign, path: '/sales-payments' },
        { name: t('nav.documents'), icon: Files, path: '/documents' },
        { name: t('nav.reports'), icon: BarChart3, path: '/sales-reports' }
      ],
      Funding: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.investors'), icon: Building2, path: '/banks' },
        { name: t('nav.investments'), icon: CreditCard, path: '/funding-credits' },
        { name: t('nav.projects'), icon: Building2, path: '/investment-projects' },
        { name: t('nav.payments'), icon: DollarSign, path: '/funding-payments' },
        { name: t('nav.tic'), icon: Calculator, path: '/tic' },
        { name: t('nav.documents'), icon: Files, path: '/documents' }
      ],
      Cashflow: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.invoices'), icon: FileText, path: '/accounting-invoices' },
        { name: t('nav.payments'), icon: DollarSign, path: '/accounting-payments' },
        { name: t('nav.calendar'), icon: Calendar, path: '/accounting-calendar' },
        { name: t('nav.suppliers'), icon: Users, path: '/accounting-suppliers' },
        { name: t('nav.office_suppliers'), icon: Building2, path: '/office-suppliers' },
        { name: t('nav.my_companies'), icon: Building2, path: '/accounting-companies' },
        { name: t('nav.investments'), icon: Building2, path: '/accounting-banks' },
        /*{ name: 'Krediti', icon: CreditCard, path: '/company-credits' },*/
        { name: t('nav.customers'), icon: Users, path: '/accounting-customers' },
        { name: t('nav.loans'), icon: TrendingUp, path: '/accounting-loans' },
        { name: t('nav.debt_status'), icon: AlertCircle, path: '/debt-status' },
        { name: t('nav.approvals'), icon: CheckCircle, path: '/accounting-approvals' },
        { name: t('nav.documents'), icon: Files, path: '/documents' }
      ],
      Retail: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.projects'), icon: FolderKanban, path: '/retail-projects' },
        { name: t('nav.land_plots'), icon: MapPin, path: '/retail-land-plots' },
        { name: t('nav.customers'), icon: Users, path: '/retail-customers' },
        { name: t('nav.retail_sales'), icon: ShoppingCart, path: '/retail-sales-payments' },
        { name: t('nav.invoices'), icon: FileText, path: '/retail-invoices' },
        { name: t('nav.documents'), icon: Files, path: '/documents' },
        { name: t('nav.reports'), icon: BarChart3, path: '/retail-reports' }
      ]
    }

    return menuConfig[currentProfile] || menuConfig.General
  }

  const menuItems = getMenuItems()

  const handleProfileChange = (profile: Profile) => {
    if (profile === 'Cashflow' && !cashflowUnlocked) {
      setPendingProfile(profile)
      setShowPasswordModal(true)
      setShowProfileDropdown(false)
    } else {
      setCurrentProfile(profile)
      setShowProfileDropdown(false)
      navigate('/')
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashflowConfigured) return

    if (password === configuredCashflowPassword) {
      setCashflowUnlocked(true)
      sessionStorage.setItem('cashflow_unlocked', 'true')
      setCurrentProfile(pendingProfile!)
      setShowPasswordModal(false)
      setPassword('')
      setPasswordError('')
      setPendingProfile(null)
      navigate('/')
    } else {
      setPasswordError(t('profiles.wrong_password'))
    }
  }

  const handlePasswordCancel = () => {
    if (currentProfile === 'Cashflow' && !cashflowUnlocked) {
      setCurrentProfile('General')
      navigate('/')
    }
    setShowPasswordModal(false)
    setPassword('')
    setPasswordError('')
    setPendingProfile(null)
  }

  useEffect(() => {
    if (!showPasswordModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        handlePasswordCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showPasswordModal])

  const profiles: Profile[] = ['General', 'Supervision', 'Sales', 'Funding', 'Cashflow', 'Retail']

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 safe-top">
        <div className="w-full px-3 lg:px-6">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-1 lg:pl-8">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden touch-target flex items-center justify-center -ml-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                aria-label="Open navigation menu"
              >
                <MenuIcon className="w-6 h-6" />
              </button>
              <Building2 className="w-7 h-7 lg:w-8 lg:h-8 text-blue-600 lg:mr-3" />
              <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">Cognilion</h1>
            </div>
            <div className="flex items-center space-x-1 lg:space-x-6">
              {user?.role !== 'Supervision' && (
                <div className="relative hidden lg:block" ref={profileDropdownRef}>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                  >
                    <User className="w-4 h-4" />
                    <span className="font-medium">{currentProfile}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                      {profiles.map((profile) => (
                        <button
                          key={profile}
                          onClick={() => handleProfileChange(profile)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center justify-between ${
                            currentProfile === profile ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <span>{profile}</span>
                          {profile === 'Cashflow' && <Lock className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => navigate('/chat')}
                className={`relative p-2 transition-colors duration-200 ${
                  location.pathname === '/chat'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                title="Chat"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ring-2 ring-white dark:ring-gray-800">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/tasks')}
                className={`relative p-2 transition-colors duration-200 ${
                  location.pathname === '/tasks'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                title="Zadaci"
              >
                <CheckSquare className="w-5 h-5" />
                {taskUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ring-2 ring-white dark:ring-gray-800">
                    {taskUnread > 99 ? '99+' : taskUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/calendar')}
                className={`relative p-2 transition-colors duration-200 ${
                  location.pathname === '/calendar'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                title="Kalendar"
              >
                <Calendar className="w-5 h-5" />
                {eventUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ring-2 ring-white dark:ring-gray-800">
                    {eventUnread > 99 ? '99+' : eventUnread}
                  </span>
                )}
              </button>
              <div className="hidden lg:block">
                <LanguageSwitcher />
              </div>
              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="hidden lg:block p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={logout}
                className="hidden lg:flex items-center px-2 lg:px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 lg:mr-1" />
                <span className="hidden lg:inline">{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex relative">
        {/* Mobile drawer backdrop */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 top-16 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0
            fixed top-16 bottom-0 left-0 z-40 w-64 overflow-y-auto lg:overflow-visible shadow-lg
            transform transition-transform duration-300 ease-in-out
            lg:static lg:top-0 lg:bottom-auto lg:z-auto lg:min-h-screen lg:shadow-sm lg:translate-x-0 lg:transition-all
            ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
            ${sidebarOpen ? 'lg:w-64' : 'lg:w-16'}`}
        >
          {/* Desktop-only collapse toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors z-10"
            title={sidebarOpen ? 'Zatvori sidebar' : 'Otvori sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          <div className="flex flex-col min-h-full">
            <div className={`flex items-center justify-between px-4 pt-5 pb-3 ${sidebarExpanded ? 'block' : 'hidden'}`}>
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-base tracking-tight">Menu</span>
              {/* Mobile-only close button */}
              <button
                onClick={() => setMobileNavOpen(false)}
                className="lg:hidden touch-target flex items-center justify-center text-gray-500 dark:text-gray-400"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={sidebarExpanded ? 'hidden' : 'h-14'} />

            <nav className="p-2 flex-1">
              <ul className="space-y-1">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.path}
                        onClick={() => setMobileNavOpen(false)}
                        className={`flex items-center py-2.5 lg:py-2 px-3 rounded-lg transition-colors duration-200 group relative
                          ${isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                          }`}
                        title={!sidebarExpanded ? item.name : undefined}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0 min-w-[1.25rem]" />
                        <span
                          className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarExpanded ? 'max-w-xs opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'}`}
                        >
                          {item.name}
                        </span>
                        {!sidebarExpanded && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Mobile-only profile switcher (lives in the header on desktop) */}
            {user?.role !== 'Supervision' && (
              <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 p-2">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {t('profiles.title', 'Profile')}
                </p>
                <ul className="space-y-1">
                  {profiles.map((profile) => (
                    <li key={profile}>
                      <button
                        onClick={() => handleProfileChange(profile)}
                        className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg text-sm transition-colors duration-200 ${
                          currentProfile === profile
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {profile}
                        </span>
                        {profile === 'Cashflow' && <Lock className="w-3 h-3" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mobile-only account section (language, theme, logout live in the header on desktop) */}
            <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 p-2 safe-bottom">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t('common.account', 'Account')}
              </p>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('common.language', 'Language')}
                </span>
                <LanguageSwitcher />
              </div>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>
                  {isDark ? t('common.light_mode', 'Light mode') : t('common.dark_mode', 'Dark mode')}
                </span>
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6 overflow-x-auto">
          <Suspense fallback={<PageFallback />}>
            {children}
          </Suspense>
        </main>
      </div>

      <AiChatWidget />

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5 sm:p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cashflow</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {cashflowConfigured
                    ? t('profiles.unlock_title')
                    : t('profiles.cashflow_misconfigured_title')}
                </p>
              </div>
            </div>

            {cashflowConfigured ? (
              <form onSubmit={handlePasswordSubmit} noValidate>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('auth.password')}
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPasswordError('')
                    }}
                    placeholder={t('profiles.enter_password')}
                    autoFocus
                    aria-invalid={!!passwordError}
                    className={passwordError ? 'border-red-500 focus:ring-red-500' : ''}
                  />
                  {passwordError && (
                    <p className="text-xs text-red-600 mt-1">{passwordError}</p>
                  )}
                </div>


                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    {t('common.confirm')}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordCancel}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {t('profiles.cashflow_misconfigured_body')}
                </p>
                <button
                  type="button"
                  onClick={handlePasswordCancel}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout
