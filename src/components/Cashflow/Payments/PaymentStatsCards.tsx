import React from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, TrendingUp, TrendingDown, Scale, Receipt } from 'lucide-react'
import { Payment } from './types'
import { StatCard, StatGrid } from '../../ui'
import { formatEuro } from '../../../utils/formatters'
import { paymentDirection } from '../services/invoiceHelpers'
import { paymentTotalsByDirection, formatSignedEuro } from '../services/paymentTotals'

interface PaymentStatsCardsProps {
  /** The **filtered** list — the rows the table below is showing. */
  payments: Payment[]
}

/**
 * Six cards over the payments the filters left standing.
 *
 * What they replaced: "Ukupan iznos" and "Ovaj mjesec" each added income and expense into one
 * figure, which answers nothing — a month of sales receipts stacked on that month's supplier
 * payments. They are now In / Out / Net, the same three the Funding payments screen shows, from
 * the same helper. The count used to run over every loaded payment, including the ones with no
 * joined invoice that the table drops, so it could stand above a shorter list; and the cards
 * ignored the filters entirely, so filtering to one company left the totals on the whole book.
 *
 * VAT keeps its own two cards: VAT is a per-invoice share of each payment, not a direction.
 */
const PaymentStatsCards: React.FC<PaymentStatsCardsProps> = ({ payments }) => {
  const { t } = useTranslation()

  const totals = paymentTotalsByDirection(
    payments.map(p => ({ amount: p.amount, direction: paymentDirection(p.accounting_invoices?.invoice_type) }))
  )

  // The VAT actually settled by a payment is the invoice's VAT in the same proportion as the
  // payment is of the invoice total — a half-paid invoice has settled half its VAT.
  const vatPaidOn = (prefix: 'INCOMING_' | 'OUTGOING_'): number =>
    payments.reduce((sum, p) => {
      const invoice = p.accounting_invoices
      if (!invoice || !invoice.invoice_type.startsWith(prefix)) return sum
      const vatRatio = invoice.total_amount ? p.amount / invoice.total_amount : 0
      return sum + invoice.vat_amount * vatRatio
    }, 0)

  return (
    <StatGrid columns={6}>
      <StatCard
        label={t('payments.stats.total_count')}
        value={totals.count}
        icon={CreditCard}
        color="white"
      />

      <StatCard
        label={t('payments.stats.total_income')}
        value={formatEuro(totals.inflow)}
        icon={TrendingUp}
        color="green"
      />

      <StatCard
        label={t('payments.stats.total_expense')}
        value={formatEuro(totals.outflow)}
        icon={TrendingDown}
        color="red"
      />

      <StatCard
        label={t('payments.stats.net')}
        value={formatSignedEuro(totals.net)}
        icon={Scale}
        color="blue"
      />

      <StatCard
        label={t('payments.stats.vat_in')}
        value={formatEuro(vatPaidOn('INCOMING_'))}
        icon={Receipt}
        color="red"
      />

      <StatCard
        label={t('payments.stats.vat_out')}
        value={formatEuro(vatPaidOn('OUTGOING_'))}
        icon={Receipt}
        color="green"
      />
    </StatGrid>
  )
}

export default PaymentStatsCards
