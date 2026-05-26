import type { DocumentCategory, DocumentCategoryNode } from '../types'

// Map every category id in the tree to its DocumentCategory (children stripped).
export function buildIdMap(tree: DocumentCategoryNode[]): Map<string, DocumentCategory> {
  const m = new Map<string, DocumentCategory>()
  const visit = (n: DocumentCategoryNode) => {
    const { children, ...rest } = n
    m.set(n.id, rest)
    children.forEach(visit)
  }
  tree.forEach(visit)
  return m
}

// For each category node, the list of ids covering that node plus all descendants.
// Used to expand a single-category click into a flat uuid[] for the search RPC.
export function buildDescendantsMap(tree: DocumentCategoryNode[]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  const collect = (node: DocumentCategoryNode): string[] => {
    const ids: string[] = [node.id]
    for (const child of node.children) ids.push(...collect(child))
    m.set(node.id, ids)
    return ids
  }
  for (const root of tree) collect(root)
  return m
}

// Roll grouped (own-only) counts up through the tree so each node's number
// reflects its own documents plus those of its descendants.
export function rollupCounts(
  tree: DocumentCategoryNode[],
  ownByCategoryId: Map<string, number>,
): Map<string, number> {
  const totals = new Map<string, number>()
  const visit = (node: DocumentCategoryNode): number => {
    let sum = ownByCategoryId.get(node.id) ?? 0
    for (const child of node.children) sum += visit(child)
    totals.set(node.id, sum)
    return sum
  }
  for (const root of tree) visit(root)
  return totals
}

// Walk the tree and return a flat list of categories with children stripped.
export function flattenTree(nodes: DocumentCategoryNode[]): DocumentCategory[] {
  const out: DocumentCategory[] = []
  const visit = (n: DocumentCategoryNode) => {
    const { children, ...rest } = n
    out.push(rest)
    children.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}
