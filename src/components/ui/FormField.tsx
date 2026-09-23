/* eslint-disable react-refresh/only-export-components */
// Co-locates FormField with the context its controls read; the mixed-exports warning is a
// fast-refresh DX concern only.
import React, { createContext, useContext, useEffect, useId, useRef } from 'react'

interface FormFieldProps {
  label: string
  required?: boolean
  helperText?: React.ReactNode
  error?: string
  compact?: boolean
  /**
   * The field is a set of controls (a segmented control, radio options, a file picker) rather
   * than one input. The label then names the group instead of pointing at a single control.
   */
  group?: boolean
  children: React.ReactNode
  className?: string
}

interface FormFieldControl {
  /** The id the wrapped control should carry, so the <label> is linked to it. */
  controlId: string
  /** The error or helper text element describing the control, if any. */
  describedBy: string | undefined
  invalid: boolean
  required: boolean
}

const FormFieldContext = createContext<FormFieldControl | null>(null)

/**
 * The enclosing FormField's wiring, or null outside one. `Input`, `Select`, `Textarea` and
 * `SearchableSelect` read it, so a label is linked to its control without passing ids around.
 * A custom control inside a FormField can use it the same way.
 */
export function useFormFieldControl(): FormFieldControl | null {
  return useContext(FormFieldContext)
}

export default function FormField({
  label,
  required = false,
  helperText,
  error,
  compact = false,
  group = false,
  children,
  className = '',
}: FormFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const controlId = `${id}-control`
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  const helpId = `${id}-help`
  const describedBy = error ? errorId : helperText ? helpId : undefined

  const labelClasses = compact
    ? 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
    : 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  useEffect(() => {
    const node = rootRef.current
    if (!error || !node) return
    // Defer one frame so every sibling FormField has its data-form-error
    // attribute applied; querySelector then elects the first errored field
    // in DOM order — only that one actually scrolls.
    const frame = requestAnimationFrame(() => {
      const first = document.querySelector('[data-form-error="true"]')
      if (first === node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [error])

  const labelText = <>{label}{required ? ' *' : ''}</>

  return (
    <div ref={rootRef} className={className} data-form-error={error ? 'true' : undefined}>
      {group ? (
        <>
          <span id={labelId} className={labelClasses}>{labelText}</span>
          <div role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
            {children}
          </div>
        </>
      ) : (
        <FormFieldContext.Provider value={{ controlId, describedBy, invalid: !!error, required }}>
          <label htmlFor={controlId} className={labelClasses}>{labelText}</label>
          {children}
        </FormFieldContext.Provider>
      )}
      {error && <p id={errorId} className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
      {!error && helperText && <p id={helpId} className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>}
    </div>
  )
}
