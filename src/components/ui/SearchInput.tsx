import React from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({
  value,
  onClear,
  className = '',
  placeholder = 'Pretraži...',
  ...props
}, ref) => {
  const hasValue = value !== undefined && value !== ''

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})

SearchInput.displayName = 'SearchInput'

export default SearchInput
