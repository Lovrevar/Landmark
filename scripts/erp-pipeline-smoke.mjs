/**
 * End-to-end smoke test for the ERP import pipeline.
 *
 *   node --env-file=.env scripts/erp-pipeline-smoke.mjs
 *
 * Exercises the whole chain against a LIVE project: upload -> parse -> stage ->
 * resolve -> promote, plus the review queue and the reclassify loop. It writes
 * real rows and cleans up after itself, so point it at dev, never production.
 *
 * Needs ERP_IMPORT_SECRET (the value set with `supabase secrets set`) and a
 * project with at least one accounting_companies, subcontractors and projects
 * row — the e2e anchor rows are enough.
 *
 * The unit tests in supabase/functions/import-erp/ cover parsing and validation
 * logic. This covers the parts they cannot: the SQL, the triggers, and the
 * interaction between them. It is what caught promotion cherry-picking the
 * resolvable lines out of a partially-resolved document.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.ERP_IMPORT_SECRET

if (!URL || !SERVICE_KEY) throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
if (!SECRET) throw new Error('ERP_IMPORT_SECRET is required (the value passed to `supabase secrets set`)')
if (/xhlgviunhitdgzkeucxc/.test(URL)) throw new Error('refusing to run against production')

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
const erp = db.schema('erp')

let failures = 0
const check = (label, passed) => {
  if (!passed) failures++
  console.log(`  ${passed ? '\x1b[32mok  \x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${label}`)
}

async function upload(feed, name, content) {
  const form = new FormData()
  form.append('feed', feed)
  form.append('file', new Blob([content], { type: 'text/csv' }), name)
  const res = await fetch(`${URL}/functions/v1/import-erp`, {
    method: 'POST', headers: { 'x-erp-import-secret': SECRET }, body: form,
  })
  return res.json()
}

async function reset() {
  await db.from('accounting_payments').delete().eq('source', 'erp')
  await db.from('accounting_invoices').delete().eq('source', 'erp')
  await erp.from('import_runs').delete().not('id', 'is', null)
  for (const [t, k] of [
    ['account_map', 'account_code'], ['cost_center_map', 'cost_center_code'],
    ['partner_map', 'erp_id'], ['chart_of_accounts', 'account_code'],
    ['cost_centers', 'code'], ['partners', 'erp_id'],
  ]) await erp.from(t).delete().not(k, 'is', null)
  await db.from('invoice_categories').delete().like('name', '\\_\\_SMOKE%')
  await db.from('company_bank_accounts').delete().like('bank_name', '\\_\\_SMOKE%')
}

const one = async (table, cols = 'id') => {
  const { data } = await db.from(table).select(cols).limit(1).maybeSingle()
  if (!data) throw new Error(`this project has no ${table} row; run e2e/support/anchor-setup.sql`)
  return data
}

await reset()

const company = await one('accounting_companies', 'id, oib')
const supplier = await one('subcontractors')
const project = await one('projects')
const { data: category } = await db.from('invoice_categories')
  .insert({ name: '__SMOKE_Category', sort_order: 999 }).select('id').single()
const { data: account } = await db.from('company_bank_accounts').insert({
  company_id: company.id, bank_name: '__SMOKE Bank',
  account_number: 'HR0000000000000000001', initial_balance: 0, current_balance: 0,
}).select('id').single()

console.log('\nreference feeds')
for (const [feed, body] of [
  ['accounts', 'account_code;name;active\n0572;Gradnja;1\n9999;Drugi konto;1\n'],
  ['cost_centers', 'code;name;active\nMT-01;Gradilište A;1\n'],
  ['partners', 'erp_id;name;oib;active\nP-5;VODOVOD d.o.o.;98765432109;1\n'],
]) {
  const r = await upload(feed, `${feed}.csv`, body)
  check(`${feed} imported`, r.rows_rejected === 0 && r.rows_staged > 0)
}

await erp.from('account_map').upsert({ account_code: '0572', role: 'expense', invoice_category_id: category.id }, { onConflict: 'account_code' })
await erp.from('cost_center_map').upsert({ cost_center_code: 'MT-01', project_id: project.id }, { onConflict: 'cost_center_code' })
await erp.from('partner_map').upsert({ erp_id: 'P-5', entity_kind: 'subcontractor', entity_id: supplier.id }, { onConflict: 'erp_id' })

// Two lines, two VAT rates, and account 9999 deliberately left unmapped.
const HEADER = 'erp_id;line_no;direction;document_type;company_oib;partner_erp_id;partner_name;invoice_number;issue_date;due_date;cost_center_code;account_code;base_amount;vat_rate;vat_amount;line_total;invoice_total;currency;updated_at'
const INVOICES = `${HEADER}
INV-X;1;INCOMING;INVOICE;${company.oib};P-5;VODOVOD d.o.o.;R-X;2026-08-05;2026-08-19;MT-01;0572;100,00;25;25,00;125,00;225,00;EUR;2026-08-20T10:00:00Z
INV-X;2;INCOMING;INVOICE;${company.oib};P-5;VODOVOD d.o.o.;R-X;2026-08-05;2026-08-19;MT-01;9999;80,00;13;20,00;100,00;225,00;EUR;2026-08-20T10:00:00Z
`

console.log('\nimport auto-classifies, and a document is all-or-nothing')
const run = await upload('invoices', 'invoices.csv', INVOICES)
check('parsed and staged', run.rows_staged === 2 && run.rows_rejected === 0)
check('nothing promoted while one line is unmapped', run.promoted === 0)
const { data: queue, error: queueError } = await db.from('erp_review_queue').select('*')
check('review queue readable', !queueError)
check('held document lists all its lines', queue?.length === 1 && queue[0].line_count === 2)
check('problem names the unmapped account', queue?.[0]?.problems?.some(p => p.includes('9999')))

console.log('\nfix the mapping, then reclassify')
await erp.from('account_map').upsert({ account_code: '9999', role: 'expense', invoice_category_id: category.id }, { onConflict: 'account_code' })
const { data: re } = await db.rpc('erp_reclassify', { p_run_id: run.run_id })
const r0 = Array.isArray(re) ? re[0] : re
check('promotes once the code is mapped', r0?.promoted === 1 && r0?.unresolved === 0)

const { data: inv } = await db.from('accounting_invoices')
  .select('total_amount, base_amount, vat_amount, base_amount_1, vat_amount_1, base_amount_2, vat_amount_2, project_id, supplier_id, invoice_type')
  .eq('erp_document_key', 'INV-X').maybeSingle()
check('25% folded into slot 1', Number(inv?.base_amount_1) === 100 && Number(inv?.vat_amount_1) === 25)
check('13% folded into slot 2', Number(inv?.base_amount_2) === 80 && Number(inv?.vat_amount_2) === 20)
check("total is the ERP's, not recomputed", Number(inv?.total_amount) === 225)
check('legacy aggregate columns filled', Number(inv?.base_amount) === 180 && Number(inv?.vat_amount) === 45)
check('invoice_type derived', inv?.invoice_type === 'INCOMING_SUPPLIER')
check('project resolved from the cost centre', inv?.project_id === project.id)
check('supplier resolved from the partner', inv?.supplier_id === supplier.id)
const { data: emptied } = await db.from('erp_review_queue').select('document_ref')
check('queue emptied', (emptied ?? []).length === 0)

console.log('\nposted VAT survives a rate that does not match the nominal one')
const ODD = `${HEADER}
INV-V;1;INCOMING;INVOICE;${company.oib};P-5;VODOVOD d.o.o.;R-V;2026-08-05;2026-08-19;MT-01;0572;4024,47;13;438,53;4463,00;4463,00;EUR;2026-08-20T10:00:00Z
`
await upload('invoices', 'odd.csv', ODD)
const { data: odd } = await db.from('accounting_invoices')
  .select('total_amount, vat_amount_2').eq('erp_document_key', 'INV-V').maybeSingle()
// 13% of 4024.47 would be 523.18. The ledger says 438.53 (partial deductibility).
check('438.53 not recomputed to 523.18', Number(odd?.vat_amount_2) === 438.53)
check('4463.00 total preserved', Number(odd?.total_amount) === 4463)

console.log('\nre-importing an unchanged file writes nothing')
const again = await upload('invoices', 'invoices.csv', INVOICES)
check('unchanged document skipped', again.promoted === 0 && again.skipped === 1)

console.log('\na VAT rate with no slot is refused rather than rounded')
await upload('invoices', 'badrate.csv', `${HEADER}
INV-Z;1;INCOMING;INVOICE;${company.oib};P-5;VODOVOD d.o.o.;R-Z;2026-08-05;2026-08-19;MT-01;0572;100,00;10;10,00;110,00;110,00;EUR;2026-08-20T10:00:00Z
`)
const { data: held } = await db.from('erp_review_queue').select('problems').eq('document_ref', 'INV-Z').maybeSingle()
check('10% held for review', held?.problems?.some(p => p.includes('no slot')))

console.log('\npayments settle the invoice through the existing triggers')
const pay = await upload('payments', 'payments.csv',
  `erp_id;allocation_no;invoice_erp_id;allocated_amount;payment_total;payment_date;payment_method;settlement_type;company_iban;updated_at
PAY-1;1;INV-V;4463,00;4463,00;2026-08-20;WIRE;BANK;HR0000000000000000001;2026-08-21T10:00:00Z
`)
check('payment promoted', pay.promoted === 1)
const { data: settled } = await db.from('accounting_invoices')
  .select('paid_amount, remaining_amount, status').eq('erp_document_key', 'INV-V').maybeSingle()
check('paid_amount set by the payment trigger', Number(settled?.paid_amount) === 4463)
check('status flipped to PAID', settled?.status === 'PAID')

await reset()
await db.from('company_bank_accounts').delete().eq('id', account.id)
await db.from('invoice_categories').delete().eq('id', category.id)

console.log(failures === 0 ? '\n\x1b[32mall checks passed\x1b[0m' : `\n\x1b[31m${failures} check(s) failed\x1b[0m`)
process.exit(failures === 0 ? 0 : 1)
