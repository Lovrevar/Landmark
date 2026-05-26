import React from 'react'
import { ChevronRight } from 'lucide-react'
import type { DocumentCategoryNode } from '../types'

interface CategoryRowProps {
  node: DocumentCategoryNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  counts: Map<string, number>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

export const CategoryRow: React.FC<CategoryRowProps> = ({
  node, depth, selectedId, expandedIds, counts, onSelect, onToggle,
}) => {
  const expanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isSelected = node.id === selectedId
  const count = counts.get(node.id) ?? 0

  // Row click selects, and also expands collapsed parents (never collapses).
  // The chevron is the dedicated collapse-only control.
  const handleRowClick = () => {
    onSelect(node.id)
    if (hasChildren && !expanded) onToggle(node.id)
  }

  return (
    <>
      <div
        onClick={handleRowClick}
        className={[
          'flex items-center gap-1 pr-2 py-1.5 rounded text-sm cursor-pointer transition-colors select-none',
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id) }}
            className="flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1 truncate">{node.name_hr}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{count}</span>
      </div>
      {expanded && node.children.map(child => (
        <CategoryRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          counts={counts}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}
