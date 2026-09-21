import React from 'react'
import { useTranslation } from 'react-i18next'
import { ApartmentWithDetails } from '../types'
import { Modal, Badge, Button } from '../../../ui'
import { formatDate } from '../../../../utils/formatters'
import { UNIT_STATUS, statusLabel, statusVariant } from '../../../../utils/statusDisplay'

interface ApartmentDetailsModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
}

const formatAmount = (val: number | null | undefined): string => {
  if (val == null) return '—'
  return `€${val.toLocaleString('hr-HR')}`
}

const hasContractData = (apartment: ApartmentWithDetails): boolean => {
  return !!(
    apartment.datum_potpisa_predugovora ||
    apartment.contract_payment_type ||
    apartment.kapara_10_posto != null ||
    apartment.rata_1_ab_konstrukcija_30 != null ||
    apartment.rata_2_postava_stolarije_20 != null ||
    apartment.rata_3_obrtnicki_radovi_20 != null ||
    apartment.rata_4_uporabna_20 != null ||
    apartment.kredit_etaziranje_90 != null
  )
}

export const ApartmentDetailsModal: React.FC<ApartmentDetailsModalProps> = ({
  visible,
  onClose,
  apartment
}) => {
  const { t, i18n } = useTranslation()

  // `contract_payment_type` is a CHECK column ('credit' | 'installments') and is compared below,
  // so only the label is translated.
  const paymentTypeLabel = apartment?.contract_payment_type
    ? t(`apartments.contracted.${apartment.contract_payment_type}`)
    : '—'

  if (!visible || !apartment) return null

  const showContract = hasContractData(apartment)

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title={t('apartments.details')} onClose={onClose} />

      <Modal.Body>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('apartments.table.number')}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{apartment.number}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('common.status')}</p>
              <Badge variant={statusVariant(UNIT_STATUS, apartment.status)}>
                {statusLabel(UNIT_STATUS, apartment.status, t)}
              </Badge>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('apartments.details_modal.location')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('common.project')}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{apartment.project_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('common.building')}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{apartment.building_name}</span>
              </div>
              <div className="flex justify-between">
                {/* `apartments.form.floor` already reads "Kat (Etaža)" / "Floor (Etaža)" — the
                    Croatian spreadsheet term is inside the key, not appended here. */}
                <span className="text-gray-600 dark:text-gray-400">{t('apartments.form.floor')}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{apartment.floor}</span>
              </div>
              {apartment.ulaz && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('apartments.form.entrance')}:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{apartment.ulaz}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('apartments.details_modal.specs')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {apartment.tip_stana && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('apartments.form.type')}:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{apartment.tip_stana}</span>
                </div>
              )}
              {apartment.sobnost != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('apartments.form.rooms')}:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{apartment.sobnost}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.saleable_area')}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{apartment.size_m2} m²</span>
              </div>
              {apartment.povrsina_otvoreno != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.open_area')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{apartment.povrsina_otvoreno} m²</span>
                </div>
              )}
              {apartment.povrsina_ot_sa_koef != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.open_area_coef')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{apartment.povrsina_ot_sa_koef} m²</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('apartments.table.price')}:</span>
                <span className="font-bold text-green-600">€{apartment.price.toLocaleString('hr-HR')}</span>
              </div>
            </div>
          </div>

          {apartment.buyer_name && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('apartments.details_modal.buyer_info')}</h4>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('apartments.table.buyer')}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{apartment.buyer_name}</span>
              </div>
            </div>
          )}

          {showContract && <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('apartments.details_modal.contract')}</h4>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.presale_date')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDate(apartment.datum_potpisa_predugovora, i18n.language)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.payment_type')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{paymentTypeLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.kapara')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatAmount(apartment.kapara_10_posto)}</span>
              </div>
              {apartment.contract_payment_type === 'installments' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.rate1')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatAmount(apartment.rata_1_ab_konstrukcija_30)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.rate2')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatAmount(apartment.rata_2_postava_stolarije_20)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.rate3')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatAmount(apartment.rata_3_obrtnicki_radovi_20)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.rate4')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatAmount(apartment.rata_4_uporabna_20)}</span>
                  </div>
                </>
              )}
              {apartment.contract_payment_type === 'credit' && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('apartments.details_modal.credit')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatAmount(apartment.kredit_etaziranje_90)}</span>
                </div>
              )}
            </div>
          </div>}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </Modal.Footer>
    </Modal>
  )
}
