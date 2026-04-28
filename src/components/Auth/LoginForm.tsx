import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, type LoginErrorCode } from '../../contexts/AuthContext'
import { Building2, Lock, User, CheckCircle2 } from 'lucide-react'
import Input from '../ui/Input'

type Mode = 'signin' | 'reset'

interface FieldErrors {
  email?: string
  password?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LoginForm: React.FC = () => {
  const { t } = useTranslation()
  const { login, resetPassword } = useAuth()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const errorKey = (code: LoginErrorCode) => `auth.error_${code}`

  const validate = (opts: { requirePassword: boolean }): FieldErrors => {
    const errors: FieldErrors = {}
    const trimmed = email.trim()
    if (!trimmed) {
      errors.email = t('auth.email_required')
    } else if (!EMAIL_REGEX.test(trimmed)) {
      errors.email = t('auth.email_invalid')
    }
    if (opts.requirePassword && !password) {
      errors.password = t('auth.password_required')
    }
    return errors
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }))
    if (formError) setFormError('')
    if (successMessage) setSuccessMessage('')
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }))
    if (formError) setFormError('')
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setFieldErrors({})
    setFormError('')
    setSuccessMessage('')
    setPassword('')
  }

  const applyAuthError = (code: LoginErrorCode) => {
    const message = t(errorKey(code))
    if (code === 'invalid_credentials') {
      setFieldErrors({ password: message })
    } else if (code === 'email_not_confirmed' || code === 'no_user_record') {
      setFieldErrors({ email: message })
    } else {
      setFormError(message)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validate({ requirePassword: true })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    setFormError('')
    const result = await login(email.trim(), password)
    setLoading(false)

    if (!result.success) {
      applyAuthError(result.code)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validate({ requirePassword: false })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    setFormError('')
    setSuccessMessage('')
    const result = await resetPassword(email.trim())
    setLoading(false)

    if (result.success) {
      setSuccessMessage(t('auth.reset_link_sent'))
    } else {
      setFormError(t(errorKey(result.code)))
    }
  }

  const emailFieldClass = `pl-10 pr-4 py-3 transition-all duration-200 ${fieldErrors.email ? 'border-red-500 focus:ring-red-500' : ''}`
  const passwordFieldClass = `pl-10 pr-4 py-3 transition-all duration-200 ${fieldErrors.password ? 'border-red-500 focus:ring-red-500' : ''}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {mode === 'signin' ? 'Cognilion' : t('auth.reset_password')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {mode === 'signin' ? t('auth.admin_portal') : t('auth.reset_password_subtitle')}
            </p>
          </div>

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} noValidate className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className={emailFieldClass}
                    placeholder="Enter your email"
                    aria-invalid={!!fieldErrors.email}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className={passwordFieldClass}
                    placeholder="Enter your password"
                    aria-invalid={!!fieldErrors.password}
                  />
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
                )}
              </div>

              {formError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                {loading ? t('auth.signing_in') : t('auth.sign_in')}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t('auth.forgot_password')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleReset} noValidate className="space-y-6">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className={emailFieldClass}
                    placeholder="Enter your email"
                    aria-invalid={!!fieldErrors.email}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>

              {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {formError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                {loading ? t('auth.sending_reset_link') : t('auth.send_reset_link')}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t('auth.back_to_sign_in')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginForm
