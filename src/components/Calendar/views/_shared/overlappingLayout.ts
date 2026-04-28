import type { ExpandedOccurrence } from '../../utils/recurrence'

export interface PositionedOccurrence {
  occurrence: ExpandedOccurrence
  column: number
  columnsInCluster: number
}

/** A group of occurrences whose time ranges chain-overlap. Grouping lets the
 *  renderer decide per-cluster whether to render side-by-side or collapse into
 *  a "+N more" chip when there are too many concurrent events to render
 *  legibly. */
export interface OccurrenceCluster {
  items: PositionedOccurrence[]
  columnsInCluster: number
  /** Earliest start time in the cluster — used as the anchor for the overflow chip. */
  clusterStart: Date
  /** Latest end time in the cluster — useful for positioning chip relative to the cluster. */
  clusterEnd: Date
}

interface InternalCluster {
  items: ExpandedOccurrence[]
  end: number
  start: number
}

/** Greedy column assignment for a single day's occurrences, grouped into
 *  clusters of chain-overlapping events. All inputs are assumed to fall on the
 *  same day; callers slice by day first. */
export function layoutOccurrences(occurrences: ExpandedOccurrence[]): OccurrenceCluster[] {
  const sorted = [...occurrences].sort((a, b) => {
    const sa = a.start.getTime()
    const sb = b.start.getTime()
    if (sa !== sb) return sa - sb
    return b.end.getTime() - a.end.getTime()
  })

  const clusters: InternalCluster[] = []
  let current: InternalCluster | null = null

  for (const occ of sorted) {
    if (!current || occ.start.getTime() >= current.end) {
      current = {
        items: [occ],
        start: occ.start.getTime(),
        end: occ.end.getTime(),
      }
      clusters.push(current)
    } else {
      current.items.push(occ)
      if (occ.end.getTime() > current.end) current.end = occ.end.getTime()
    }
  }

  return clusters.map(cluster => {
    const columnEnds: number[] = []
    const assignments = new Map<ExpandedOccurrence, number>()

    for (const occ of cluster.items) {
      let placed = false
      for (let i = 0; i < columnEnds.length; i++) {
        if (occ.start.getTime() >= columnEnds[i]) {
          columnEnds[i] = occ.end.getTime()
          assignments.set(occ, i)
          placed = true
          break
        }
      }
      if (!placed) {
        columnEnds.push(occ.end.getTime())
        assignments.set(occ, columnEnds.length - 1)
      }
    }

    const columnsInCluster = columnEnds.length
    const items: PositionedOccurrence[] = cluster.items.map(occ => ({
      occurrence: occ,
      column: assignments.get(occ) ?? 0,
      columnsInCluster,
    }))

    return {
      items,
      columnsInCluster,
      clusterStart: new Date(cluster.start),
      clusterEnd: new Date(cluster.end),
    }
  })
}
