/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '../components/ui/ConfirmDialog'

/**
 * How a screen saves from inside the dialog.
 *
 * Resolving `false` means the save failed. The screen has already told the user why — it owns its
 * own error reporting — so the guard only needs to know not to leave. A handler that throws is
 * treated the same way.
 */
export type UnsavedChangesSaveHandler = () => Promise<boolean>

interface UnsavedChangesValue {
  /** Declares whether the screen currently on show would lose work if it were left. */
  setDirty: (dirty: boolean) => void
  /** Registers how to save that work, so the dialog can offer it. `null` when it cannot. */
  setSaveHandler: (save: UnsavedChangesSaveHandler | null) => void
  /**
   * Runs `proceed`, first asking the user when the screen on show has unsaved work.
   * Returns true when `proceed` ran synchronously, false when it was deferred to the dialog.
   */
  requestLeave: (proceed: () => void) => boolean
}

// The default runs everything straight through, so a component using the hooks outside the
// provider (a test, a story) simply has no guard rather than crashing.
const UnsavedChangesContext = createContext<UnsavedChangesValue>({
  setDirty: () => {},
  setSaveHandler: () => {},
  requestLeave: (proceed) => {
    proceed()
    return true
  },
})

interface PendingLeave {
  proceed: () => void
  /**
   * Captured when the dialog opens rather than read live, so the buttons cannot change under the
   * user between the question and the answer.
   */
  save: UnsavedChangesSaveHandler | null
}

/**
 * One app-wide "you have unsaved work" guard.
 *
 * Only one screen is on show at a time, so a single flag is enough — a screen arms it while it
 * holds unsaved edits and disarms it on unmount. Navigation that goes through `requestLeave`
 * (every link and every `navigate()` in Layout) is held back by a dialog; reloads and closes are
 * caught by the browser's own `beforeunload` prompt.
 *
 * A screen that registers a save handler gets a third button, so the dialog offers a way out that
 * keeps the work rather than only ways that lose it or postpone the decision.
 *
 * This deliberately does not use react-router's `useBlocker`: that needs a data router, and the
 * app is mounted on `<BrowserRouter>`.
 */
export const UnsavedChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation()
  // Refs, not state: arming the guard must never re-render the whole app on every keystroke.
  const dirtyRef = useRef(false)
  const saveRef = useRef<UnsavedChangesSaveHandler | null>(null)
  const [pending, setPending] = useState<PendingLeave | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const setSaveHandler = useCallback((save: UnsavedChangesSaveHandler | null) => {
    saveRef.current = save
  }, [])

  const requestLeave = useCallback((proceed: () => void) => {
    if (!dirtyRef.current) {
      proceed()
      return true
    }
    setSaveFailed(false)
    setPending({ proceed, save: saveRef.current })
    return false
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      // The wording is the browser's own — every engine ignores a custom message.
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const leave = useCallback(() => {
    const proceed = pending?.proceed
    // Disarmed before proceeding: the screen only unmounts on the next render, and until it does
    // its own guard would block the very navigation the user just confirmed.
    dirtyRef.current = false
    setPending(null)
    proceed?.()
  }, [pending])

  const saveAndLeave = useCallback(async () => {
    if (!pending?.save) return

    setSaving(true)
    setSaveFailed(false)
    try {
      const saved = await pending.save()
      if (!saved) {
        // The dialog stays open on failure rather than leaving with the work still unsaved or
        // closing over an error the user never sees.
        setSaveFailed(true)
        return
      }
      leave()
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }, [pending, leave])

  const canSave = pending?.save != null

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, setSaveHandler, requestLeave }}>
      {children}
      <ConfirmDialog
        show={pending !== null}
        title={t('common.unsaved_changes_title')}
        message={
          <>
            <p>{t('common.unsaved_changes_message')}</p>
            {saveFailed && (
              <p className="mt-2 text-red-600 dark:text-red-400">
                {t('common.unsaved_changes_save_failed')}
              </p>
            )}
          </>
        }
        // With somewhere to save to, keeping the work is the primary action and losing it is the
        // one that has to be picked out deliberately. Without, there is only the one way on.
        variant={canSave ? 'primary' : 'danger'}
        confirmLabel={canSave ? t('common.save_and_leave') : t('common.leave_without_saving')}
        onConfirm={canSave ? saveAndLeave : leave}
        extraAction={canSave ? { label: t('common.leave_without_saving'), onClick: leave } : undefined}
        cancelLabel={t('common.stay_on_page')}
        // Escape bypasses the disabled Cancel button, so mid-save it has to be refused here too.
        onCancel={() => { if (!saving) setPending(null) }}
        loading={saving}
      />
    </UnsavedChangesContext.Provider>
  )
}

/**
 * Arms the guard while this screen holds unsaved edits.
 *
 * Pass `save` to have the dialog offer "save and leave" — it must resolve `false` (or throw)
 * when the save fails, or the user will be sent on with their work lost.
 *
 * Both are re-asserted on every render rather than only when `dirty` flips, so neither can lag
 * behind the screen: confirming a leave clears the flag, and the next render puts it back if the
 * screen is in fact still dirty.
 */
export function useUnsavedChanges(dirty: boolean, save?: UnsavedChangesSaveHandler): void {
  const { setDirty, setSaveHandler } = useContext(UnsavedChangesContext)

  useEffect(() => {
    setDirty(dirty)
    setSaveHandler(save ?? null)
  })

  useEffect(
    () => () => {
      setDirty(false)
      setSaveHandler(null)
    },
    [setDirty, setSaveHandler]
  )
}

/** The guarded way to navigate: `requestLeave(() => navigate('/somewhere'))`. */
export function useLeaveGuard(): UnsavedChangesValue['requestLeave'] {
  return useContext(UnsavedChangesContext).requestLeave
}
