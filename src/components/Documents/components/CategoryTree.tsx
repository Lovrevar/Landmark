import React from 'react'
import { ChevronRight } from 'lucide-react'
import type { DocumentCategoryNode } from '../types'

interface CategoryTreeProps {
  nodes: DocumentCategoryNode[]
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  nodes, selectedId, expandedIds, onSelect, onToggle,
}) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto bg-white dark:bg-gray-800">
    {nodes.map(node => (
      <CategoryTreeNode
        key={node.id}
        node={node}
        depth={0}
        selectedId={selectedId}
        expandedIds={expandedIds}
        onSelect={onSelect}
        onToggle={onToggle}
      />
    ))}
  </div>
)

interface CategoryTreeNodeProps {
  node: DocumentCategoryNode
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = ({
  node, depth, selectedId, expandedIds, onSelect, onToggle,
}) => {
  const expanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

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
          'flex items-center gap-1 px-2 py-1.5 cursor-pointer text-sm select-none',
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700',
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
        <span className="truncate">{node.name_hr}</span>
      </div>
      {expanded && node.children.map(child => (
        <CategoryTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}
