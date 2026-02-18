import React from 'react'

interface TableRootProps {
  children: React.ReactNode
  className?: string
}

function TableRoot({ children, className = '' }: TableRootProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          {children}
        </table>
      </div>
    </div>
  )
}

interface TableHeadProps {
  children: React.ReactNode
}

function TableHead({ children }: TableHeadProps) {
  return (
    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
      {children}
    </thead>
  )
}

interface TableBodyProps {
  children: React.ReactNode
}

function TableBody({ children }: TableBodyProps) {
  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {children}
    </tbody>
  )
}

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean
  sticky?: boolean
  children: React.ReactNode
}

function Th({ sortable = false, sticky = false, children, className = '', ...props }: ThProps) {
  const classes = [
    'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
    sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : '',
    sticky ? 'sticky right-0 bg-gray-50' : '',
    className,
  ].filter(Boolean).join(' ')

  return <th className={classes} {...props}>{children}</th>
}

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean
  children?: React.ReactNode
}

function Td({ sticky = false, children, className = '', ...props }: TdProps) {
  const classes = [
    'px-4 py-4 whitespace-nowrap text-sm text-gray-900',
    sticky ? 'sticky right-0 bg-white' : '',
    className,
  ].filter(Boolean).join(' ')

  return <td className={classes} {...props}>{children}</td>
}

interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean
  children: React.ReactNode
}

function Tr({ hoverable = true, children, className = '', ...props }: TrProps) {
  const classes = [
    hoverable ? 'hover:bg-gray-50' : '',
    className,
  ].filter(Boolean).join(' ')

  return <tr className={classes} {...props}>{children}</tr>
}

const Table = Object.assign(TableRoot, {
  Head: TableHead,
  Body: TableBody,
  Th,
  Td,
  Tr,
})

export default Table
