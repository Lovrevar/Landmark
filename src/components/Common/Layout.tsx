import React, { ReactNode, useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, Profile } from '../../contexts/AuthContext'
import { LanguageSwitcher } from './LanguageSwitcher'
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
  CheckCircle
} from 'lucide-react'
import Input from '../ui/Input'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation()
  const { currentProfile, setCurrentProfile, logout, user } = useAuth()
  const location = useLocation()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null)
  const [cashflowUnlocked, setCashflowUnlocked] = useState(() => sessionStorage.getItem('cashflow_unlocked') === 'true')
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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

  const getMenuItems = () => {
    if (user?.role === 'Supervision') {
      return [
        { name: t('nav.site_management'), icon: Building2, path: '/site-management' },
        { name: t('nav.work_logs'), icon: ClipboardCheck, path: '/work-logs' },
        { name: t('nav.payments'), icon: DollarSign, path: '/payments' },
        { name: t('nav.invoices'), icon: FileText, path: '/invoices' }
      ]
    }

    const menuConfig = {
      General: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.projects'), icon: FolderKanban, path: '/projects' },
        { name: t('nav.reports'), icon: FileText, path: '/general-reports' }
      ],
      Supervision: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.site_management'), icon: Building2, path: '/site-management' },
        { name: t('nav.subcontractors'), icon: Users, path: '/subcontractors' },
        { name: t('nav.work_logs'), icon: ClipboardCheck, path: '/work-logs' },
        { name: t('nav.payments'), icon: DollarSign, path: '/payments' },
        { name: t('nav.invoices'), icon: FileText, path: '/invoices' }
      ],
      Sales: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.apartments'), icon: Home, path: '/apartments' },
        { name: t('nav.sales_projects'), icon: Building2, path: '/sales-projects' },
        { name: t('nav.customers'), icon: Users, path: '/customers' },
        { name: t('nav.payments'), icon: DollarSign, path: '/sales-payments' },
        { name: t('nav.reports'), icon: BarChart3, path: '/sales-reports' }
      ],
      Funding: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.investors'), icon: Building2, path: '/banks' },
        { name: t('nav.investments'), icon: CreditCard, path: '/funding-credits' },
        { name: t('nav.projects'), icon: Building2, path: '/investment-projects' },
        { name: t('nav.payments'), icon: DollarSign, path: '/funding-payments' },
        { name: t('nav.tic'), icon: Calculator, path: '/tic' }
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
        { name: t('nav.approvals'), icon: CheckCircle, path: '/accounting-approvals' }
      ],
      Retail: [
        { name: t('nav.dashboard'), icon: BarChart3, path: '/' },
        { name: t('nav.projects'), icon: FolderKanban, path: '/retail-projects' },
        { name: t('nav.land_plots'), icon: MapPin, path: '/retail-land-plots' },
        { name: t('nav.customers'), icon: Users, path: '/retail-customers' },
        { name: t('nav.retail_sales'), icon: ShoppingCart, path: '/retail-sales-payments' },
        { name: t('nav.invoices'), icon: FileText, path: '/retail-invoices' },
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

    const cashflowPassword = import.meta.env.VITE_CASHFLOW_PASSWORD || 'admin'
    if (password === cashflowPassword) {
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
    setShowPasswordModal(false)
    setPassword('')
    setPasswordError('')
    setPendingProfile(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-6">
          <div className="flex justify-between h-16">
            <div className="flex items-center pl-8">
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Cognilion</h1>
            </div>
            <div className="flex items-center space-x-6">
              {user?.role !== 'Supervision' && (
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    <User className="w-4 h-4" />
                    <span className="font-medium">{currentProfile}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      {(['General', 'Supervision', 'Sales', 'Funding', 'Cashflow', 'Retail'] satisfies Profile[]).map((profile) => (
                        <button
                          key={profile}
                          onClick={() => handleProfileChange(profile)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between ${
                            currentProfile === profile ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
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
              <LanguageSwitcher />
              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-red-600 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 mr-1" />
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex relative">
        <aside
          className={`relative bg-white shadow-sm border-r border-gray-200 min-h-screen transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0`}
        > 
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors z-10"
            title={sidebarOpen ? 'Zatvori sidebar' : 'Otvori sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          <div className="flex flex-col h-full">
            <div className={`px-4 pt-5 pb-3 ${sidebarOpen ? 'block' : 'hidden'}`}>
              <span className="font-semibold text-gray-800 text-base tracking-tight">Menu</span>
            </div>
            <div className={sidebarOpen ? 'hidden' : 'h-14'} />

            <nav className="p-2 flex-1">
              <ul className="space-y-1">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.path}
                        className={`flex items-center py-2 px-3 rounded-lg transition-colors duration-200 group relative
                          ${isActive
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0 min-w-[1.25rem]" />
                        <span
                          className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarOpen ? 'max-w-xs opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'}`}
                        >
                          {item.name}
                        </span>
                        {!sidebarOpen && (
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
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-x-auto">
          {children}
        </main>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Cashflow</h2>
                <p className="text-sm text-gray-600">{t('profiles.unlock_title')}</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                />
              </div>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{passwordError}</p>
                </div>
              )}

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
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout