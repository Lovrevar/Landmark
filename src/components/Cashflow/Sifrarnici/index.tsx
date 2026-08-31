import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, Building2, Landmark, Users } from 'lucide-react'
import {
  Badge, Button, Card, EmptyState, LoadingSpinner, PageHeader,
  SearchInput, Select, Table, Tabs,
} from '../../ui'
// Not re-exported from ui/index.ts.
import ToggleSwitch from '../../ui/ToggleSwitch'
import { useSifrarnici } from './hooks/useSifrarnici'
import {
  ACCOUNT_ROLES, PARTNER_ENTITY_KINDS, VAT_ROLES,
  type AccountRole, type PartnerEntityKind, type SifrarnikTab,
} from './types'

/**
 * Šifrarnici — maps 4D Wand codes onto Cognilion entities so the importer can
 * classify invoices without a human. See docs/erp-integration/SPEC.md §7.
 *
 * The lists are empty until the reference-data feeds land (phase 2), which is
 * why every tab has a real empty state rather than a bare table.
 */
export default function Sifrarnici() {
  const { t } = useTranslation()
  const s = useSifrarnici()

  const tabs: { id: SifrarnikTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'accounts', label: t('sifrarnici.tab_accounts'), icon: <BookMarked className="w-4 h-4" />, count: s.unmappedCounts.accounts || undefined },
    { id: 'cost_centers', label: t('sifrarnici.tab_cost_centers'), icon: <Building2 className="w-4 h-4" />, count: s.unmappedCounts.cost_centers || undefined },
    { id: 'partners', label: t('sifrarnici.tab_partners'), icon: <Users className="w-4 h-4" />, count: s.unmappedCounts.partners || undefined },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('sifrarnici.title')}
        description={t('sifrarnici.description')}
        actions={<Button variant="secondary" onClick={() => void s.reload()}>{t('common.refresh')}</Button>}
      />

      <Card>
        <Tabs tabs={tabs} activeTab={s.activeTab} onChange={s.setActiveTab} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
          <SearchInput
            value={s.searchTerm}
            onChange={e => s.setSearchTerm(e.target.value)}
            onClear={() => s.setSearchTerm('')}
            placeholder={t('sifrarnici.search_placeholder')}
            className="flex-1"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
            <ToggleSwitch checked={s.onlyUnmapped} onChange={s.setOnlyUnmapped} />
            {t('sifrarnici.only_unmapped')}
          </label>
        </div>

        {s.error && (
          <p className="text-sm text-red-600 dark:text-red-400 pb-3">{s.error}</p>
        )}

        {s.loading ? (
          <LoadingSpinner />
        ) : s.activeTab === 'accounts' ? (
          <AccountsTab s={s} />
        ) : s.activeTab === 'cost_centers' ? (
          <CostCentersTab s={s} />
        ) : (
          <PartnersTab s={s} />
        )}
      </Card>
    </div>
  )
}

type S = ReturnType<typeof useSifrarnici>

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

function AccountsTab({ s }: { s: S }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState<string | null>(null)

  if (s.accounts.length === 0) {
    return (
      <EmptyState
        icon={BookMarked}
        title={t('sifrarnici.empty_accounts')}
        description={t('sifrarnici.empty_hint')}
      />
    )
  }

  const update = async (code: string, patch: Partial<{ role: AccountRole; invoice_category_id: string | null; vat_rate: number | null; bank_id: string | null }>) => {
    const row = s.accounts.find(a => a.account_code === code)
    if (!row) return
    const next = {
      account_code: code,
      role: row.mapping?.role ?? 'unclassified',
      invoice_category_id: row.mapping?.invoice_category_id ?? null,
      vat_rate: row.mapping?.vat_rate ?? null,
      bank_id: row.mapping?.bank_id ?? null,
      notes: row.mapping?.notes ?? null,
      ...patch,
    }
    // Mirrors the CHECK constraints: a VAT account needs a rate, a bank
    // account needs a bank. Clearing the role clears what no longer applies.
    if (!VAT_ROLES.includes(next.role)) next.vat_rate = null
    if (next.role !== 'bank') next.bank_id = null

    setSaving(code)
    try {
      await s.saveAccount(next)
    } catch (e) {
      console.error('Failed to save account mapping:', e)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Table>
      <Table.Head>
        <Table.Tr>
          <Table.Th>{t('sifrarnici.col_code')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_name')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_role')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_target')}</Table.Th>
          <Table.Th><span className="sr-only">{t('common.actions')}</span></Table.Th>
        </Table.Tr>
      </Table.Head>
      <Table.Body>
        {s.filteredAccounts.map(a => {
          const role = a.mapping?.role ?? 'unclassified'
          const busy = saving === a.account_code
          return (
            <Table.Tr key={a.account_code}>
              <Table.Td label={t('sifrarnici.col_code')}>
                <span className="font-mono">{a.account_code}</span>
              </Table.Td>
              <Table.Td label={t('sifrarnici.col_name')}>{a.name}</Table.Td>
              <Table.Td label={t('sifrarnici.col_role')}>
                <Select
                  compact
                  disabled={busy}
                  value={role}
                  onChange={e => void update(a.account_code, { role: e.target.value as AccountRole })}
                >
                  {ACCOUNT_ROLES.map(r => (
                    <option key={r} value={r}>{t(`sifrarnici.role.${r}`)}</option>
                  ))}
                </Select>
              </Table.Td>
              <Table.Td label={t('sifrarnici.col_target')}>
                {role === 'expense' ? (
                  <Select
                    compact
                    disabled={busy}
                    value={a.mapping?.invoice_category_id ?? ''}
                    onChange={e => void update(a.account_code, { invoice_category_id: e.target.value || null })}
                  >
                    <option value="">{t('sifrarnici.no_category')}</option>
                    {s.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                ) : VAT_ROLES.includes(role) ? (
                  <Select
                    compact
                    disabled={busy}
                    value={a.mapping?.vat_rate ?? ''}
                    onChange={e => void update(a.account_code, { vat_rate: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">{t('sifrarnici.pick_vat_rate')}</option>
                    {[0, 5, 13, 25].map(r => <option key={r} value={r}>{r}%</option>)}
                  </Select>
                ) : role === 'bank' ? (
                  <Select
                    compact
                    disabled={busy}
                    value={a.mapping?.bank_id ?? ''}
                    onChange={e => void update(a.account_code, { bank_id: e.target.value || null })}
                  >
                    <option value="">{t('sifrarnici.pick_bank')}</option>
                    {s.banks.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </Select>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </Table.Td>
              <Table.Td>
                {a.mapping && (
                  <Button variant="ghost" size="sm" disabled={busy}
                    onClick={() => void s.clearAccount(a.account_code)}>
                    {t('common.clear')}
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Body>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Cost centres
// ---------------------------------------------------------------------------

function CostCentersTab({ s }: { s: S }) {
  const { t } = useTranslation()

  if (s.costCenters.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title={t('sifrarnici.empty_cost_centers')}
        description={t('sifrarnici.empty_cost_centers_hint')}
      />
    )
  }

  const update = async (code: string, value: string) => {
    // value is "p:<id>" for a project or "r:<id>" for a retail project — the
    // CHECK constraint allows exactly one of the two.
    const [kind, id] = value.split(':')
    try {
      await s.saveCostCenter({
        cost_center_code: code,
        project_id: kind === 'p' ? id : null,
        retail_project_id: kind === 'r' ? id : null,
        notes: null,
      })
    } catch (e) {
      console.error('Failed to save cost centre mapping:', e)
    }
  }

  return (
    <Table>
      <Table.Head>
        <Table.Tr>
          <Table.Th>{t('sifrarnici.col_code')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_name')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_project')}</Table.Th>
          <Table.Th><span className="sr-only">{t('common.actions')}</span></Table.Th>
        </Table.Tr>
      </Table.Head>
      <Table.Body>
        {s.filteredCostCenters.map(c => {
          const current = c.mapping?.project_id ? `p:${c.mapping.project_id}`
            : c.mapping?.retail_project_id ? `r:${c.mapping.retail_project_id}` : ''
          return (
            <Table.Tr key={c.code}>
              <Table.Td label={t('sifrarnici.col_code')}>
                <span className="font-mono">{c.code}</span>
              </Table.Td>
              <Table.Td label={t('sifrarnici.col_name')}>{c.name}</Table.Td>
              <Table.Td label={t('sifrarnici.col_project')}>
                <Select compact value={current} onChange={e => void update(c.code, e.target.value)}>
                  <option value="">{t('sifrarnici.no_project')}</option>
                  <optgroup label={t('sifrarnici.group_projects')}>
                    {s.projects.map(p => <option key={p.id} value={`p:${p.id}`}>{p.label}</option>)}
                  </optgroup>
                  <optgroup label={t('sifrarnici.group_retail_projects')}>
                    {s.retailProjects.map(p => <option key={p.id} value={`r:${p.id}`}>{p.label}</option>)}
                  </optgroup>
                </Select>
              </Table.Td>
              <Table.Td>
                {c.mapping && (
                  <Button variant="ghost" size="sm" onClick={() => void s.clearCostCenter(c.code)}>
                    {t('common.clear')}
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Body>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

function PartnersTab({ s }: { s: S }) {
  const { t } = useTranslation()
  // A kind chosen but not yet paired with an entity cannot be saved —
  // erp.partner_map.entity_id is NOT NULL — so it is held here until it can be.
  const [pendingKind, setPendingKind] = useState<Record<number, PartnerEntityKind>>({})

  if (s.partners.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title={t('sifrarnici.empty_partners')}
        description={t('sifrarnici.empty_partners_hint')}
      />
    )
  }

  return (
    <Table>
      <Table.Head>
        <Table.Tr>
          <Table.Th>{t('sifrarnici.col_kom_id')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_name')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_oib')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_kind')}</Table.Th>
          <Table.Th>{t('sifrarnici.col_entity')}</Table.Th>
          <Table.Th><span className="sr-only">{t('common.actions')}</span></Table.Th>
        </Table.Tr>
      </Table.Head>
      <Table.Body>
        {s.filteredPartners.map(p => {
          const kind = pendingKind[p.kom_id] ?? p.mapping?.entity_kind ?? ''
          const options = kind ? s.partnerTargets[kind as PartnerEntityKind] : undefined
          return (
            <Table.Tr key={p.kom_id}>
              <Table.Td label={t('sifrarnici.col_kom_id')}>
                <span className="font-mono">{p.kom_id}</span>
              </Table.Td>
              <Table.Td label={t('sifrarnici.col_name')}>{p.name}</Table.Td>
              <Table.Td label={t('sifrarnici.col_oib')}>
                {p.oib ?? <Badge variant="warning">{t('sifrarnici.no_oib')}</Badge>}
              </Table.Td>
              <Table.Td label={t('sifrarnici.col_kind')}>
                <Select
                  compact
                  value={kind}
                  onChange={e => {
                    const k = e.target.value as PartnerEntityKind
                    setPendingKind(prev => ({ ...prev, [p.kom_id]: k }))
                    if (k) void s.ensurePartnerTargets(k)
                  }}
                >
                  <option value="">{t('sifrarnici.pick_kind')}</option>
                  {PARTNER_ENTITY_KINDS.map(k => (
                    <option key={k} value={k}>{t(`sifrarnici.kind.${k}`)}</option>
                  ))}
                </Select>
              </Table.Td>
              <Table.Td label={t('sifrarnici.col_entity')}>
                {kind ? (
                  <Select
                    compact
                    value={p.mapping?.entity_id ?? ''}
                    onChange={e => {
                      if (!e.target.value) return
                      void s.savePartner({
                        kom_id: p.kom_id,
                        entity_kind: kind as PartnerEntityKind,
                        entity_id: e.target.value,
                        notes: null,
                      })
                    }}
                  >
                    <option value="">{t('sifrarnici.pick_entity')}</option>
                    {(options ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </Select>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </Table.Td>
              <Table.Td>
                {(p.mapping || pendingKind[p.kom_id]) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPendingKind(prev => {
                        const next = { ...prev }
                        delete next[p.kom_id]
                        return next
                      })
                      if (p.mapping) void s.clearPartner(p.kom_id)
                    }}
                  >
                    {t('common.clear')}
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Body>
    </Table>
  )
}
