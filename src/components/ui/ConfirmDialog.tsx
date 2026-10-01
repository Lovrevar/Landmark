import React, { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useFocusTrap } from '../../hooks/useFocusTrap'

/**
 * A third choice, for a question that genuinely has one — "save and leave" alongside "leave
 * without saving". Rendered between Cancel and Confirm, so the confirm button stays the primary
 * action wherever it already is.
 */
export interface ConfirmDialogAction {
  label: string
  onClick: () => void
  variant?: React.ComponentProps<typeof Button>['variant']
  disabled?: boolean
}

interface ConfirmDialogProps {
  show: boolean
  title: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  extraAction?: ConfirmDialogAction
}

export default function ConfirmDialog({
  show,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
  extraAction,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm')
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel')

  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const messageId = useId()

  useEscapeKey(show, onCancel)
  // Focus starts on Cancel: the one choice that is always safe, so a reflexive Enter never
  // confirms a delete.
  useFocusTrap(panelRef, show, { initialFocus: cancelRef })

  if (!show) return null

  const dialogContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={panelRef}
        role={variant === 'danger' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-3 sm:mx-4 p-5 sm:p-6 outline-none"
      >
        <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <div id={messageId} className="text-gray-600 dark:text-gray-400 mb-6">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
          <Button
            ref={cancelRef}
            variant="ghost"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            {resolvedCancelLabel}
          </Button>
          {extraAction && (
            <Button
              variant={extraAction.variant ?? 'outline-danger'}
              type="button"
              onClick={extraAction.onClick}
              disabled={loading || extraAction.disabled}
            >
              {extraAction.label}
            </Button>
          )}
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            type="button"
            onClick={onConfirm}
            loading={loading}
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(dialogContent, document.body)
}
