import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Split } from 'lucide-react'
import { Modal, Button, Input, Alert } from '../../../ui'
import { formatNumber, type LineItemPhaseAmount } from '../utils/ticFormatters'
import { phaseSplitCheck } from '../utils/ticBudget'

interface PhaseSplitModalProps {
  show: boolean
  onClose: () => void
  /** The row being split, for the heading. */
  itemName: string
  /** The row's own totals — what a split is expected to add up to. */
  vlastita: number
  kreditna: number
  /** How many phase columns the table has, so every row offers the same ones. */
  phaseCount: number
  /** The row's current split, or undefined when the cost is not phased. */
  phases: LineItemPhaseAmount[] | undefined
  onSave: (phases: LineItemPhaseAmount[] | undefined) => void
}

/** Round to cents, so an even split of an odd number does not carry float noise into the plan. */
const toCents = (value: number): number => Math.round(value * 100) / 100

/**
 * The mismatch, to the cent.
 *
 * `formatNumber` rounds to whole euros everywhere else in the TIC, which is right for a plan of
 * millions and wrong here: a gap of 0,40 € would print as "0" and read as no gap at all.
 */
const formatDifference = (value: number): string =>
  new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

/**
 * Lay the row's split out across `phaseCount` phases, keeping whatever is already there.
 *
 * A phase the row has never carried starts at zero rather than being guessed at: an even split
 * is one button away, and a wrong guess would be indistinguishable from a real plan.
 */
const draftFor = (phases: LineItemPhaseAmount[] | undefined, phaseCount: number): LineItemPhaseAmount[] =>
  Array.from({ length: phaseCount }, (_, i) => {
    const existing = phases?.find((p) => p.phase_number === i + 1)
    return { phase_number: i + 1, vlastita: existing?.vlastita ?? 0, kreditna: existing?.kreditna ?? 0 }
  })

/**
 * Editor for one investment row's per-phase split.
 *
 * Kept out of the table because a split is two figures per phase: inline, three phases would add
 * six inputs to every row. The modal also has room for the thing that actually matters here —
 * whether the split adds up to the row it divides, and whether the cost is phased at all.
 */
const PhaseSplitModal: React.FC<PhaseSplitModalProps> = ({
  show,
  onClose,
  itemName,
  vlastita,
  kreditna,
  phaseCount,
  phases,
  onSave,
}) => {
  const { t } = useTranslation()
  const [phased, setPhased] = useState(false)
  const [draft, setDraft] = useState<LineItemPhaseAmount[]>([])

  // Reopening on another row must not show the previous row's numbers.
  useEffect(() => {
    if (!show) return
    setPhased(!!phases && phases.length > 0)
    setDraft(draftFor(phases, phaseCount))
  }, [show, phases, phaseCount])

  const updatePhase = (index: number, patch: Partial<LineItemPhaseAmount>) => {
    setDraft((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  /** Spread the row evenly and give the rounding remainder to the last phase, so it still adds up. */
  const splitEvenly = () => {
    if (phaseCount === 0) return
    const share = (total: number) => toCents(total / phaseCount)
    const vlastitaShare = share(vlastita)
    const kreditnaShare = share(kreditna)

    setDraft(
      Array.from({ length: phaseCount }, (_, i) => {
        const last = i === phaseCount - 1
        return {
          phase_number: i + 1,
          vlastita: last ? toCents(vlastita - vlastitaShare * (phaseCount - 1)) : vlastitaShare,
          kreditna: last ? toCents(kreditna - kreditnaShare * (phaseCount - 1)) : kreditnaShare,
        }
      })
    )
    setPhased(true)
  }

  const check = phaseSplitCheck({ name: itemName, vlastita, kreditna, phases: draft })
  const rowTotal = vlastita + kreditna

  const handleSave = () => {
    // An unphased row keeps no split at all — a zeroed one would read as "planned at nothing"
    // rather than "not attributed to a phase", and the two mean different things to the budget.
    onSave(phased ? draft : undefined)
    onClose()
  }

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header title={t('tic.phases.edit_title')} subtitle={itemName || t('tic.row_name_placeholder')} onClose={onClose} />

      <Modal.Body>
        <fieldset className="space-y-3">
          <legend className="sr-only">{t('tic.phases.edit_title')}</legend>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              checked={!phased}
              onChange={() => setPhased(false)}
              className="mt-1 accent-blue-600"
            />
            <span>
              <span className="font-medium text-gray-900 dark:text-white">{t('tic.phases.mode_unphased')}</span>
              <span className="block text-sm text-gray-600 dark:text-gray-400">
                {t('tic.phases.mode_unphased_hint')}
              </span>
            </span>
          </label>

          <label className={`flex items-start gap-3 ${phaseCount === 0 ? 'opacity-50' : 'cursor-pointer'}`}>
            <input
              type="radio"
              checked={phased}
              disabled={phaseCount === 0}
              onChange={() => setPhased(true)}
              className="mt-1 accent-blue-600"
            />
            <span>
              <span className="font-medium text-gray-900 dark:text-white">{t('tic.phases.mode_phased')}</span>
              <span className="block text-sm text-gray-600 dark:text-gray-400">
                {phaseCount === 0 ? t('tic.phases.no_phases_hint') : t('tic.phases.mode_phased_hint')}
              </span>
            </span>
          </label>
        </fieldset>

        {phased && phaseCount > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-bold text-gray-900 dark:text-white">
                      {t('common.phase')}
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">
                      {t('tic.col_own_funds')}
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">
                      {t('tic.col_credit_funds')}
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">
                      {t('common.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((phase, index) => (
                    <tr key={phase.phase_number}>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {t('common.phase')} {phase.phase_number}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={phase.vlastita}
                          onChange={(e) => updatePhase(index, { vlastita: parseFloat(e.target.value) || 0 })}
                          className="px-2 py-1 text-right border-gray-200 dark:border-gray-600"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={phase.kreditna}
                          onChange={(e) => updatePhase(index, { kreditna: parseFloat(e.target.value) || 0 })}
                          className="px-2 py-1 text-right border-gray-200 dark:border-gray-600"
                        />
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatNumber(phase.vlastita + phase.kreditna)}
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white">
                      {t('tic.phases.sum_label')}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-gray-900 dark:text-white whitespace-nowrap">
                      {formatNumber(check.vlastita)}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-gray-900 dark:text-white whitespace-nowrap">
                      {formatNumber(check.kreditna)}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-gray-900 dark:text-white whitespace-nowrap">
                      {formatNumber(check.vlastita + check.kreditna)}
                    </td>
                  </tr>

                  <tr className="bg-blue-50 dark:bg-blue-900/30 font-bold">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white">
                      {t('tic.phases.row_total_label')}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-blue-900 dark:text-blue-100 whitespace-nowrap">
                      {formatNumber(vlastita)}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-blue-900 dark:text-blue-100 whitespace-nowrap">
                      {formatNumber(kreditna)}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-blue-900 dark:text-blue-100 whitespace-nowrap">
                      {formatNumber(rowTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" icon={Split} onClick={splitEvenly}>
                {t('tic.phases.split_evenly')}
              </Button>
            </div>

            {!check.balanced && (
              <Alert variant="warning">
                {t('tic.phases.mismatch_warning', {
                  difference: formatDifference(check.vlastitaDiff + check.kreditnaDiff),
                })}
              </Alert>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave}>{t('common.save')}</Button>
      </Modal.Footer>
    </Modal>
  )
}

export default PhaseSplitModal
