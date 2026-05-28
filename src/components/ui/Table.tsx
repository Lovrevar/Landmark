import React, { createContext, useContext } from 'react'

// Lets Th/Td pick tighter padding when the table opts into dense mode.
const DensityContext = createContext(false)

interface TableRootProps {
  children: React.ReactNode
  className?: string
  dense?: boolean
  /** Size the table to its content (left-aligned) instead of stretching to fill the
   *  container. Avoids wide inter-column gaps on sparse tables on large screens. */
  fitContent?: boolean
}

function TableRoot({ children, className = '', dense = false, fitContent = false }: TableRootProps) {
  // `responsive-table` enables the card-view layout on mobile (see index.css).
  return (
    <DensityContext.Provider value={dense}>
      <div className={`responsive-table bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
        <div className="overflow-x-auto">
          <table className={fitContent ? 'min-w-max' : 'w-full min-w-max'}>
            {children}
          </table>
        </div>
      </div>
    </DensityContext.Provider>
  )
}

interface TableHeadProps {
  children: React.ReactNode
}

function TableHead({ children }: TableHeadProps) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      {children}
    </thead>
  )
}

interface TableBodyProps {
  children: React.ReactNode
}

function TableBody({ children }: TableBodyProps) {
  return (
    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
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
  const dense = useContext(DensityContext)
  const classes = [
    dense ? 'px-3 py-2' : 'px-4 py-3',
    'text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
    sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none' : '',
    sticky ? 'sticky right-0 bg-gray-50 dark:bg-gray-900' : '',
    className,
  ].filter(Boolean).join(' ')

  return <th className={classes} {...props}>{children}</th>
}

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean
  /** Column label shown beside the value in the mobile card view. */
  label?: string
  children?: React.ReactNode
}

function Td({ sticky = false, label, children, className = '', ...props }: TdProps) {
  const dense = useContext(DensityContext)
  const classes = [
    dense ? 'px-3 py-2.5' : 'px-4 py-4',
    'whitespace-nowrap text-sm text-gray-900 dark:text-gray-100',
    sticky ? 'sticky right-0 bg-white dark:bg-gray-800' : '',
    className,
  ].filter(Boolean).join(' ')

  return <td className={classes} data-label={label} {...props}>{children}</td>
}

interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean
  children: React.ReactNode
}

function Tr({ hoverable = true, children, className = '', ...props }: TrProps) {
  const classes = [
    hoverable ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : '',
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
