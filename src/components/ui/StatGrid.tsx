import React from 'react'

interface StatGridProps {
  columns?: 2 | 3 | 4 | 5 | 6
  children: React.ReactNode
  className?: string
}

const colStyles: Record<number, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-5',
  6: 'grid-cols-1 md:grid-cols-6',
}

export default function StatGrid({
  columns = 4,
  children,
  className = '',
}: StatGridProps) {
  return (
    <div className={`grid ${colStyles[columns]} gap-4 ${className}`}>
      {children}
    </div>
  )
}
