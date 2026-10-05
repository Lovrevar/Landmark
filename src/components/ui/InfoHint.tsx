import React, { useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HelpCircle, type LucideIcon } from 'lucide-react'
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { helpArticlePath } from '../../lib/helpKb'
import { logHelpEvent } from '../../lib/helpEvents'

interface InfoHintProps {
  /** Stable name for this hint, recorded when it is opened (e.g. `budget_control.cpi`). */
  hintId: string
  /** What the hint explains — the accessible name of the "?" button and the popover's heading. */
  label: string
  /** The explanation. Keep it to a sentence or two; the durable version belongs in the article. */
  children: React.ReactNode
  /** A `help-kb` article id; adds a "more" link to it on the Help page. */
  articleId?: string
  /** Replaces the "?" — a warning triangle, say, when the hint explains a flagged value. */
  icon?: LucideIcon
  /** Colour classes for the trigger. Defaults to a quiet grey that turns blue on hover. */
  className?: string
}

/**
 * A "?" beside a label that opens a short explanation on click.
 *
 * Click rather than hover, so it works on a phone and with a keyboard — which is what the native
 * `title` tooltips it replaces could not do. The popover is portalled, so a scrolling table or a
 * modal body cannot clip it, and it joins the same Escape and focus stacks as every other layer:
 * inside a modal, Escape closes the hint and leaves the modal open.
 */
const DEFAULT_TONE = 'text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400'

export default function InfoHint({ hintId, label, children, articleId, icon: Icon = HelpCircle, className = DEFAULT_TONE }: InfoHintProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const headingId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (next && !open) logHelpEvent({ action: 'help.hint_open', hintId, page: location.pathname })
    setOpen(next)
  }

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: handleOpenChange,
    placement: 'top',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  // Escape goes through the app's own layer stack (below), not floating-ui's document listener,
  // which would also let the modal underneath hear the key.
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { escapeKey: false }),
  ])

  useEscapeKey(open, () => setOpen(false))
  useFocusTrap(panelRef, open)

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        aria-label={t('help.hint.button_label', { topic: label })}
        aria-expanded={open}
        className={`inline-flex flex-shrink-0 items-center justify-center align-middle rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
        {...getReferenceProps({ onClick: (e) => e.stopPropagation() })}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <FloatingPortal>
          <div
            ref={(node) => {
              panelRef.current = node
              refs.setFloating(node)
            }}
            role="dialog"
            aria-labelledby={headingId}
            tabIndex={-1}
            style={floatingStyles}
            className="z-[70] w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 shadow-lg text-left text-sm font-normal normal-case tracking-normal text-gray-700 dark:text-gray-200 focus:outline-none"
            {...getFloatingProps()}
          >
            <p id={headingId} className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
            <div className="space-y-1.5 whitespace-normal">{children}</div>
            {articleId && (
              <Link
                to={helpArticlePath(articleId)}
                // A new tab, so a half-filled form behind the hint is not lost.
                target="_blank"
                rel="noopener"
                className="mt-2 inline-block text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t('help.hint.more')}
              </Link>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
