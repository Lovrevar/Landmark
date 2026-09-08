/**
 * Renders a phase as "Faza 2 · Izgradnja zgrade A", or just "Faza 2" when the phase's name adds
 * nothing to its number.
 *
 * After the phase/classification split most phases are stored as literally "Faza 1", so naively
 * prefixing the number produced "Faza 1 · Faza 1". Anything showing a phase to a user should go
 * through here rather than concatenating the two fields itself.
 */

/** A name that is just some word followed by a number, e.g. "Faza 1", "Phase 02", "Etapa 3". */
const WORD_PLUS_NUMBER = /^(\p{L}+)\s*0*(\d+)$/u
/** A name that is only a number. */
const NUMBER_ONLY = /^0*(\d+)$/

/**
 * True when the name carries no information beyond the phase number.
 *
 * Matched structurally rather than against the translated word for "phase": names are stored as
 * literal Croatian ("Faza 1") while the UI may be in English, so comparing against
 * `t('common.phase')` collapsed only when the two languages happened to agree.
 */
function nameIsRedundant(name: string, phaseNumber: number): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true

  const numberOnly = NUMBER_ONLY.exec(trimmed)
  if (numberOnly) return Number(numberOnly[1]) === phaseNumber

  const wordPlusNumber = WORD_PLUS_NUMBER.exec(trimmed)
  if (wordPlusNumber) return Number(wordPlusNumber[2]) === phaseNumber

  return false
}

/**
 * @param phaseWord the translated word for "phase" (`t('common.phase')`), passed in so this
 *                  stays a pure function
 */
export function formatPhaseLabel(
  phase: { phase_number: number; phase_name: string },
  phaseWord: string
): string {
  const prefix = `${phaseWord} ${phase.phase_number}`
  const name = (phase.phase_name ?? '').trim()

  return nameIsRedundant(name, phase.phase_number) ? prefix : `${prefix} · ${name}`
}
