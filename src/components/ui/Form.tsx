import React, { createContext, useContext, useState } from 'react'

export const FormSubmittingContext = createContext(false)

export const useFormSubmitting = () => useContext(FormSubmittingContext)

interface FormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => Promise<void> | void
}

const Form: React.FC<FormProps> = ({ onSubmit, children, ...props }) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting || !onSubmit) return
    const result = onSubmit(e)
    if (result instanceof Promise) {
      setIsSubmitting(true)
      try {
        await result
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <FormSubmittingContext.Provider value={isSubmitting}>
      <form onSubmit={handleSubmit} {...props}>
        {children}
      </form>
    </FormSubmittingContext.Provider>
  )
}

export default Form
