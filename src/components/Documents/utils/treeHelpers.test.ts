import { describe, it, expect } from 'vitest'
import {
  buildIdMap,
  buildDescendantsMap,
  rollupCounts,
  flattenTree,
} from './treeHelpers'
import type { DocumentCategoryNode } from '../types'

const cat = (id: string, name: string, parent_id: string | null, children: DocumentCategoryNode[] = []): DocumentCategoryNode => ({
  id,
  code: id,
  name_hr: name,
  parent_id,
  path: id,
  display_order: 0,
  required_associations: [],
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  children,
})

// Sample tree:
//   root1
//     a
//       a1
//       a2
//     b
//   root2
//     c
const sampleTree: DocumentCategoryNode[] = [
  cat('root1', 'Root 1', null, [
    cat('a', 'A', 'root1', [
      cat('a1', 'A1', 'a'),
      cat('a2', 'A2', 'a'),
    ]),
    cat('b', 'B', 'root1'),
  ]),
  cat('root2', 'Root 2', null, [
    cat('c', 'C', 'root2'),
  ]),
]

describe('buildIdMap', () => {
  it('maps every id in the tree, including descendants', () => {
    const m = buildIdMap(sampleTree)
    expect(m.size).toBe(7)
    expect(Array.from(m.keys()).sort()).toEqual(['a', 'a1', 'a2', 'b', 'c', 'root1', 'root2'])
  })

  it('strips children from the mapped values', () => {
    const m = buildIdMap(sampleTree)
    const root1 = m.get('root1')
    expect(root1).toBeDefined()
    expect('children' in (root1 as object)).toBe(false)
  })

  it('returns an empty map for an empty tree', () => {
    expect(buildIdMap([]).size).toBe(0)
  })
})

describe('buildDescendantsMap', () => {
  it('lists a leaf only as itself', () => {
    const m = buildDescendantsMap(sampleTree)
    expect(m.get('a1')).toEqual(['a1'])
    expect(m.get('a2')).toEqual(['a2'])
  })

  it('lists a node plus all its descendants', () => {
    const m = buildDescendantsMap(sampleTree)
    // Order: parent first (preorder traversal)
    expect(m.get('a')).toEqual(['a', 'a1', 'a2'])
    expect(m.get('root1')).toEqual(['root1', 'a', 'a1', 'a2', 'b'])
  })

  it('returns an empty map for an empty tree', () => {
    expect(buildDescendantsMap([]).size).toBe(0)
  })
})

describe('rollupCounts', () => {
  it('sums child counts into ancestors', () => {
    const own = new Map<string, number>([
      ['a1', 3],
      ['a2', 2],
      ['b', 5],
      ['c', 7],
    ])
    const rolled = rollupCounts(sampleTree, own)
    expect(rolled.get('a1')).toBe(3)
    expect(rolled.get('a2')).toBe(2)
    expect(rolled.get('b')).toBe(5)
    expect(rolled.get('a')).toBe(5)         // 3 + 2
    expect(rolled.get('root1')).toBe(10)    // 5 (a) + 5 (b)
    expect(rolled.get('c')).toBe(7)
    expect(rolled.get('root2')).toBe(7)
  })

  it('returns 0 for nodes with no own count and no descendants', () => {
    const rolled = rollupCounts(sampleTree, new Map())
    expect(rolled.get('a1')).toBe(0)
    expect(rolled.get('root1')).toBe(0)
  })

  it('returns the same total for a leaf as its own count', () => {
    const own = new Map<string, number>([['a1', 9]])
    const rolled = rollupCounts(sampleTree, own)
    expect(rolled.get('a1')).toBe(9)
  })
})

describe('flattenTree', () => {
  it('returns every node in preorder', () => {
    const flat = flattenTree(sampleTree)
    expect(flat.map(c => c.id)).toEqual(['root1', 'a', 'a1', 'a2', 'b', 'root2', 'c'])
  })

  it('strips children', () => {
    const flat = flattenTree(sampleTree)
    flat.forEach(c => expect('children' in (c as object)).toBe(false))
  })

  it('returns an empty array for an empty tree', () => {
    expect(flattenTree([])).toEqual([])
  })
})
