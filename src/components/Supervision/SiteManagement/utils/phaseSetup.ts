import { PhaseFormInput } from '../types'

/**
 * The saved phases the phase-setup form no longer contains — the ones saving it would delete.
 *
 * Mirrors `phaseService.updateProjectPhases`, which deletes every existing phase whose id is not
 * in the submitted list. Lowering the count slices rows off the end, and raising it again adds
 * id-less rows, so a phase that was sliced off and "re-added" is still reported here.
 */
export const findRemovedPhases = <P extends { id: string }>(
  existing: readonly P[],
  phases: readonly PhaseFormInput[]
): P[] => {
  const keptIds = new Set(phases.map(p => p.id).filter((id): id is string => !!id))
  return existing.filter(p => !keptIds.has(p.id))
}
