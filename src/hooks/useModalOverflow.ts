import { useEffect } from 'react'

export const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden'
}

export const unlockBodyScroll = () => {
  document.body.style.overflow = 'unset'
}

export const useModalOverflow = (isOpen: boolean) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])
}
