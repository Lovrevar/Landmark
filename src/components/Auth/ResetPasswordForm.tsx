import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Building2, Lock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Input from '../ui/Input'
import PageFallback from '../Common/PageFallback'

// Supabase's own floor is 6; staff passwords guard financial data.
const MIN_PASSWORD_LENGTH = 8

interface FieldErrors {
  password?: string
  confirm?: string
}

/**
 * Landing page of the "forgot password" email. supabase-js turns the link into a recovery session
 * (detectSessionInUrl), so the user arrives signed in; without a session the link was invalid,
 * already used or expired.
 */
const ResetPasswordForm: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { isAuthenticated, loading: authLoading, updatePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  if (authLoading) return <PageFallback />

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = t('auth.password_too_short', { min: MIN_PASSWORD_LENGTH })
    }
    if (confirm !== password) {
      errors.confirm = t('auth.passwords_do_not_match')
    }
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setFormError('')
    const ok = await updatePassword(password)
    setSaving(false)
    if (!ok) {
      setFormError(t('auth.password_update_failed'))
      return
    }
    toast.success(t('auth.password_updated'))
    navigate('/', { replace: true })
  }

  const fieldClass = (hasError: boolean) =>
    `pl-10 pr-4 py-3 transition-all duration-200 ${hasError ? 'border-red-500 focus:ring-red-500' : ''}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('auth.set_new_password')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {isAuthenticated ? t('auth.set_new_password_subtitle') : t('auth.reset_link_invalid')}
            </p>
          </div>

          {isAuthenticated ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('auth.new_password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={fieldClass(!!fieldErrors.password)}
                    aria-invalid={!!fieldErrors.password}
                  />
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('auth.confirm_password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={fieldClass(!!fieldErrors.confirm)}
                    aria-invalid={!!fieldErrors.confirm}
                  />
                </div>
                {fieldErrors.confirm && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.confirm}</p>
                )}
              </div>

              {formError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                {saving ? t('auth.saving_password') : t('auth.save_password')}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {t('auth.back_to_sign_in')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordForm
