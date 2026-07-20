// Demo-data seeder for the shared dev/test Supabase project.
//
// Wipes all business data (users, document_categories and lookup tables that hold
// no business data are preserved) and inserts a coherent Croatian demo dataset
// across Projects, Supervision, Sales, Cashflow, Funding, Retail and Tasks so the
// app can be showcased with realistic, mutually consistent numbers.
//
// Derived fields (invoice status/paid amounts, contract realizacija, bank account
// balances, credit utilization) are NOT set by hand — the DB triggers compute them
// from the payments we insert, exactly as in production use.
//
// Usage:  node --env-file=.env scripts/seed-demo-data.mjs

import { createClient } from '@supabase/supabase-js'

const EXPECTED_PROJECT = 'ktfaimjkcvhkftwbnnwy' // shared dev/test project (same as E2E allowlist)

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (run with --env-file=.env)')
if (!url.includes(EXPECTED_PROJECT)) {
  throw new Error(`Safety check failed: ${url} is not the expected test project (${EXPECTED_PROJECT}). Refusing to wipe.`)
}

const db = createClient(url, key, { auth: { persistSession: false } })

// ---------- helpers ----------

let counter = 0
/** Deterministic valid v4-shaped uuid, readable in the DB ("d0000000-...-<n>"). */
function uid() {
  counter += 1
  return `d0000000-0000-4000-a000-${String(counter).padStart(12, '0')}`
}

async function ins(table, rows) {
  // defaultToNull: false — in bulk inserts PostgREST fills keys missing from some
  // rows with NULL instead of the column DEFAULT; this restores DEFAULT semantics.
  const { error } = await db.from(table).insert(rows, { defaultToNull: false })
  if (error) throw new Error(`insert ${table}: ${error.message}`)
  console.log(`  + ${table}: ${rows.length}`)
}

async function wipe(table, pk = 'id', kind = 'uuid') {
  let q = db.from(table).delete()
  q = kind === 'uuid' ? q.neq(pk, '00000000-0000-0000-0000-000000000000') : q.neq(pk, -1)
  const { error } = await q
  if (error) throw new Error(`wipe ${table}: ${error.message}`)
  console.log(`  - wiped ${table}`)
}

const iso = (d) => d // dates passed as 'YYYY-MM-DD' strings

// ---------- main ----------

console.log(`Seeding demo data into ${url}`)

// Users are preserved; we need their ids for created_by / project_managers / tasks.
const { data: users, error: usersErr } = await db.from('users').select('id, auth_user_id, email, role')
if (usersErr) throw new Error(`fetch users: ${usersErr.message}`)
if (!users?.length) throw new Error('No users found — provision users first (e.g. run the e2e globalSetup or create app users).')

const director = users.find((u) => u.role === 'Director') ?? users[0]
const supervisionUsers = users.filter((u) => u.role === 'Supervision')
const salesUser = users.find((u) => u.role === 'Sales') ?? director
const authId = director.auth_user_id // for accounting created_by (FK -> auth.users)
console.log(`Using ${users.length} existing users (director: ${director.email})`)

// ---------- 1. WIPE (children before parents; users + document_categories kept) ----------

console.log('\nWiping existing data…')
await wipe('activity_logs')
await wipe('ai_message_attachments')
await wipe('ai_messages')
await wipe('ai_sessions')
await wipe('document_associations')
await wipe('documents')
await wipe('chat_messages')
await wipe('chat_participants')
await wipe('chat_conversations')
await wipe('task_comments')
await wipe('task_attachments')
await wipe('task_assignees')
await wipe('tasks')
await wipe('calendar_reminder_sends')
await wipe('calendar_notifications')
await wipe('calendar_occurrence_responses')
await wipe('calendar_event_exceptions')
await wipe('calendar_event_participants')
await wipe('calendar_events')
await wipe('accounting_payments')
await wipe('hidden_approved_invoices')
await wipe('accounting_invoices')
await wipe('company_loans')
await wipe('subcontractor_milestones')
await wipe('subcontractor_comments')
await wipe('work_logs')
await wipe('contracts')
await wipe('subcontractors')
await wipe('contract_types', 'id', 'int')
await wipe('credit_allocations')
await wipe('bank_credits')
await wipe('tic_cost_structures')
await wipe('banks')
await wipe('monthly_budgets')
await wipe('sales')
await wipe('apartment_garages')
await wipe('apartment_repositories')
await wipe('apartments')
await wipe('garages')
await wipe('repositories')
await wipe('buildings')
await wipe('customers')
await wipe('retail_sales')
await wipe('retail_contract_milestones')
await wipe('retail_contracts')
await wipe('retail_customers')
await wipe('retail_suppliers')
await wipe('retail_supplier_types')
await wipe('retail_land_plots')
await wipe('retail_project_phases')
await wipe('retail_projects')
await wipe('project_milestones')
await wipe('project_phases')
await wipe('project_managers')
await wipe('projects')
await wipe('office_suppliers')
await wipe('company_loans')
await wipe('company_bank_accounts')
await wipe('accounting_companies')
await wipe('invoice_categories')

// ---------- 2. COMPANIES & BANK ACCOUNTS ----------

console.log('\nInserting demo data…')

const C_PARENT = uid(), C_JARUN = uid(), C_MARJAN = uid(), C_GRADNJA = uid()
await ins('accounting_companies', [
  { id: C_PARENT, name: 'Adriatic Development d.o.o.', oib: '23456789012', initial_balance: 0 },
  { id: C_JARUN, name: 'AD Projekt Jarun d.o.o.', oib: '34567890123', initial_balance: 0 },
  { id: C_MARJAN, name: 'AD Projekt Marjan d.o.o.', oib: '45678901234', initial_balance: 0 },
  { id: C_GRADNJA, name: 'AD Gradnja d.o.o.', oib: '56789012345', initial_balance: 0 },
])

const ACC_PARENT_ZABA = uid(), ACC_PARENT_PBZ = uid(), ACC_JARUN = uid(), ACC_MARJAN = uid(), ACC_GRADNJA = uid()
await ins('company_bank_accounts', [
  { id: ACC_PARENT_ZABA, company_id: C_PARENT, bank_name: 'Zagrebačka banka', account_number: 'HR1223600001101234565', initial_balance: 1400000, current_balance: 1400000 },
  { id: ACC_PARENT_PBZ, company_id: C_PARENT, bank_name: 'Privredna banka Zagreb', account_number: 'HR5223400091110987654', initial_balance: 320000, current_balance: 320000 },
  { id: ACC_JARUN, company_id: C_JARUN, bank_name: 'Zagrebačka banka', account_number: 'HR6523600001102233445', initial_balance: 1900000, current_balance: 1900000 },
  { id: ACC_MARJAN, company_id: C_MARJAN, bank_name: 'OTP banka', account_number: 'HR7424070001105566778', initial_balance: 1000000, current_balance: 1000000 },
  { id: ACC_GRADNJA, company_id: C_GRADNJA, bank_name: 'Erste banka', account_number: 'HR8824020061108899001', initial_balance: 190000, current_balance: 190000 },
])

// ---------- 3. BANKS ----------

const B_ZABA = uid(), B_PBZ = uid(), B_ERSTE = uid(), B_HBOR = uid()
await ins('banks', [
  { id: B_ZABA, name: 'Zagrebačka banka d.d.', contact_person: 'Maja Perić', contact_email: 'maja.peric@zaba.hr', contact_phone: '+385 1 6104 000', total_credit_limit: 12000000, interest_rate: 4.1, relationship_start: '2019-04-15' },
  { id: B_PBZ, name: 'Privredna banka Zagreb d.d.', contact_person: 'Igor Šimić', contact_email: 'igor.simic@pbz.hr', contact_phone: '+385 1 4891 111', total_credit_limit: 8000000, interest_rate: 4.4, relationship_start: '2021-09-01' },
  { id: B_ERSTE, name: 'Erste&Steiermärkische Bank d.d.', contact_person: 'Lana Vuković', contact_email: 'lana.vukovic@erstebank.hr', contact_phone: '+385 62 37 5000', total_credit_limit: 5000000, interest_rate: 4.9, relationship_start: '2020-02-20' },
  { id: B_HBOR, name: 'HBOR', contact_person: 'Damir Katić', contact_email: 'dkatic@hbor.hr', contact_phone: '+385 1 4591 666', total_credit_limit: 10000000, interest_rate: 2.9, relationship_start: '2024-11-05' },
])

// ---------- 4. PROJECTS, PHASES, MILESTONES ----------

const P_JARUN = uid(), P_MARJAN = uid(), P_CRNOMEREC = uid(), P_TRESNJEVKA = uid(), P_ANCHOR = uid()
await ins('projects', [
  { id: P_JARUN, name: 'Rezidencija Jarun', location: 'Zagreb — Jarun', status: 'In Progress', budget: 8500000, start_date: '2025-03-01', end_date: '2027-06-30', investor: 'Zagrebačka banka / vlastita sredstva', aliases: ['Jarun'] },
  { id: P_MARJAN, name: 'Vila Marjan', location: 'Split — Marjan', status: 'In Progress', budget: 4200000, start_date: '2025-09-01', end_date: '2027-03-31', investor: 'Vlastita sredstva', aliases: ['Marjan'] },
  { id: P_CRNOMEREC, name: 'Kvart Črnomerec', location: 'Zagreb — Črnomerec', status: 'Planning', budget: 12000000, start_date: '2026-10-01', end_date: '2029-12-31', investor: 'HBOR (odobren kredit)', aliases: ['Črnomerec'] },
  { id: P_TRESNJEVKA, name: 'Stambena zgrada Trešnjevka', location: 'Zagreb — Trešnjevka', status: 'Completed', budget: 3100000, start_date: '2023-05-01', end_date: '2025-11-30', investor: 'Erste banka', aliases: ['Trešnjevka'] },
  // E2E anchor kept so the Playwright suite still has its fixture project.
  { id: P_ANCHOR, name: 'E2E Anchor Project', location: 'E2E', status: 'In Progress', budget: 0, start_date: iso('2026-01-01'), aliases: [] },
])

const PH_J1 = uid(), PH_J2 = uid(), PH_J3 = uid(), PH_J4 = uid(), PH_J5 = uid()
const PH_M1 = uid(), PH_M2 = uid(), PH_M3 = uid()
const PH_T1 = uid(), PH_T2 = uid()
await ins('project_phases', [
  { id: PH_J1, project_id: P_JARUN, phase_number: 1, phase_name: 'Pripremni radovi i iskop', status: 'completed', budget_allocated: 350000, start_date: '2025-03-01', end_date: '2025-06-15' },
  { id: PH_J2, project_id: P_JARUN, phase_number: 2, phase_name: 'Grubi građevinski radovi', status: 'active', budget_allocated: 3300000, start_date: '2025-06-16', end_date: '2026-09-30' },
  { id: PH_J3, project_id: P_JARUN, phase_number: 3, phase_name: 'Instalacije (elektro, ViK, grijanje)', status: 'active', budget_allocated: 1650000, start_date: '2026-03-01', end_date: '2026-12-31' },
  { id: PH_J4, project_id: P_JARUN, phase_number: 4, phase_name: 'Završni radovi', status: 'planning', budget_allocated: 1900000, start_date: '2026-11-01', end_date: '2027-05-31' },
  { id: PH_J5, project_id: P_JARUN, phase_number: 5, phase_name: 'Okoliš i priključci', status: 'planning', budget_allocated: 450000, start_date: '2027-03-01', end_date: '2027-06-15' },
  { id: PH_M1, project_id: P_MARJAN, phase_number: 1, phase_name: 'Pripremni radovi', status: 'completed', budget_allocated: 220000, start_date: '2025-09-01', end_date: '2025-12-20' },
  { id: PH_M2, project_id: P_MARJAN, phase_number: 2, phase_name: 'Grubi građevinski radovi', status: 'active', budget_allocated: 1500000, start_date: '2026-01-10', end_date: '2026-11-30' },
  { id: PH_M3, project_id: P_MARJAN, phase_number: 3, phase_name: 'Završni radovi i uređenje', status: 'planning', budget_allocated: 1100000, start_date: '2026-10-01', end_date: '2027-03-15' },
  { id: uid(), project_id: P_CRNOMEREC, phase_number: 1, phase_name: 'Pripremni radovi i rušenje', status: 'planning', budget_allocated: 800000, start_date: '2026-10-01', end_date: '2027-03-31' },
  { id: uid(), project_id: P_CRNOMEREC, phase_number: 2, phase_name: 'Grubi građevinski radovi', status: 'planning', budget_allocated: 6500000, start_date: '2027-04-01', end_date: '2028-12-31' },
  { id: uid(), project_id: P_CRNOMEREC, phase_number: 3, phase_name: 'Instalacije i završni radovi', status: 'planning', budget_allocated: 3200000, start_date: '2028-06-01', end_date: '2029-09-30' },
  { id: uid(), project_id: P_CRNOMEREC, phase_number: 4, phase_name: 'Okoliš i priključci', status: 'planning', budget_allocated: 700000, start_date: '2029-06-01', end_date: '2029-12-15' },
  { id: PH_T1, project_id: P_TRESNJEVKA, phase_number: 1, phase_name: 'Gradnja', status: 'completed', budget_allocated: 2400000, start_date: '2023-05-01', end_date: '2025-05-31' },
  { id: PH_T2, project_id: P_TRESNJEVKA, phase_number: 2, phase_name: 'Završni radovi i primopredaja', status: 'completed', budget_allocated: 700000, start_date: '2025-04-01', end_date: '2025-11-30' },
])

await ins('project_milestones', [
  { id: uid(), project_id: P_JARUN, name: 'Građevinska dozvola', completed: true, due_date: '2025-02-15', phase: 'Pripremni radovi i iskop' },
  { id: uid(), project_id: P_JARUN, name: 'Temeljna ploča', completed: true, due_date: '2025-06-30', phase: 'Grubi građevinski radovi' },
  { id: uid(), project_id: P_JARUN, name: 'AB konstrukcija — Zgrada A', completed: true, due_date: '2026-03-31', phase: 'Grubi građevinski radovi' },
  { id: uid(), project_id: P_JARUN, name: 'AB konstrukcija — Zgrada B', completed: false, due_date: '2026-08-15', phase: 'Grubi građevinski radovi' },
  { id: uid(), project_id: P_JARUN, name: 'Krovište i limarija', completed: false, due_date: '2026-10-01', phase: 'Grubi građevinski radovi' },
  { id: uid(), project_id: P_JARUN, name: 'Uporabna dozvola', completed: false, due_date: '2027-05-15', phase: 'Završni radovi' },
  { id: uid(), project_id: P_MARJAN, name: 'Građevinska dozvola', completed: true, due_date: '2025-08-01', phase: 'Pripremni radovi' },
  { id: uid(), project_id: P_MARJAN, name: 'AB konstrukcija', completed: false, due_date: '2026-07-31', phase: 'Grubi građevinski radovi' },
  { id: uid(), project_id: P_MARJAN, name: 'Krovište', completed: false, due_date: '2026-11-15', phase: 'Grubi građevinski radovi' },
  { id: uid(), project_id: P_CRNOMEREC, name: 'Lokacijska dozvola', completed: false, due_date: '2026-09-30', phase: null },
  { id: uid(), project_id: P_CRNOMEREC, name: 'Građevinska dozvola', completed: false, due_date: '2027-01-31', phase: null },
  { id: uid(), project_id: P_TRESNJEVKA, name: 'Uporabna dozvola', completed: true, due_date: '2025-10-15', phase: 'Završni radovi i primopredaja' },
])

// Link Supervision users to active construction projects (and the E2E anchor user link).
const pmRows = []
for (const su of supervisionUsers) {
  pmRows.push({ id: uid(), user_id: su.id, project_id: su.email === 'e2e-supervision@mail.com' ? P_ANCHOR : P_JARUN })
  if (su.email !== 'e2e-supervision@mail.com') pmRows.push({ id: uid(), user_id: su.id, project_id: P_MARJAN })
}
if (pmRows.length) await ins('project_managers', pmRows)

// ---------- 5. SUPERVISION: subcontractors, contracts, situacije, work logs ----------

await ins('contract_types', [
  { id: 1, name: 'Građevinski radovi', is_active: true },
  { id: 2, name: 'Elektroinstalacije', is_active: true },
  { id: 3, name: 'Strojarske instalacije (ViK, grijanje)', is_active: true },
  { id: 4, name: 'Stolarija i bravarija', is_active: true },
  { id: 5, name: 'Završni radovi', is_active: true },
  { id: 6, name: 'Projektiranje i nadzor', is_active: true },
])

const S_TEHNO = uid(), S_ELEKTRO = uid(), S_TERMO = uid(), S_ALU = uid(), S_KERAMIKA = uid(), S_KROV = uid(), S_MODUL = uid(), S_GEO = uid(), S_ISKOP = uid()
await ins('subcontractors', [
  { id: S_TEHNO, name: 'Tehnogradnja d.o.o.', contact: 'Ivan Horvat · 091 234 5678 · info@tehnogradnja.hr' },
  { id: S_ELEKTRO, name: 'Elektro-Instal d.o.o.', contact: 'Marko Jurić · 098 111 2233 · marko@elektro-instal.hr' },
  { id: S_TERMO, name: 'Termo-Vod d.o.o.', contact: 'Ante Božić · 095 445 6677 · ante@termovod.hr' },
  { id: S_ALU, name: 'Alu-Mont d.o.o.', contact: 'Petra Krznarić · 091 887 5544 · petra@alumont.hr' },
  { id: S_KERAMIKA, name: 'Keramika Plus d.o.o.', contact: 'Damir Sever · 099 232 1414 · damir@keramikaplus.hr' },
  { id: S_KROV, name: 'Krovomont d.o.o.', contact: 'Stjepan Balog · 098 700 500 · info@krovomont.hr' },
  { id: S_MODUL, name: 'Arhitektonski studio Modul d.o.o.', contact: 'Iva Radić · 01 4833 210 · iva@studiomodul.hr' },
  { id: S_GEO, name: 'Geo-Nadzor d.o.o.', contact: 'Tomislav Klarić · 091 555 0102 · tomislav@geonadzor.hr' },
  { id: S_ISKOP, name: 'Iskop-Trans d.o.o.', contact: 'Branimir Vlahov · 098 606 707 · info@iskop-trans.hr' },
])

const CT_TEHNO_J = uid(), CT_ELEKTRO_J = uid(), CT_TERMO_J = uid(), CT_ALU_J = uid(), CT_MODUL_J = uid(), CT_KROV_J = uid()
const CT_TEHNO_M = uid(), CT_KERAMIKA_M = uid(), CT_TEHNO_T = uid(), CT_ELEKTRO_T = uid(), CT_ISKOP_J = uid(), CT_ISKOP_M = uid()
const contract = (id, project, phase, sub, type, num, base, status, extra = {}) => ({
  id, project_id: project, phase_id: phase, subcontractor_id: sub, contract_type_id: type,
  contract_number: num, base_amount: base, vat_rate: 25, contract_amount: base * 1.25,
  status, has_contract: true, signed: status !== 'draft',
  job_description: extra.job ?? '', start_date: extra.start ?? null, end_date: extra.end ?? null,
  signed_date: status !== 'draft' ? (extra.start ?? null) : null, budget_realized: 0,
})
await ins('contracts', [
  contract(CT_TEHNO_J, P_JARUN, PH_J2, S_TEHNO, 1, 'UG-2025-011', 2240000, 'active', { job: 'Grubi građevinski radovi — Zgrada A i B (AB konstrukcija, zidanje)', start: '2025-06-16', end: '2026-09-30' }),
  contract(CT_ELEKTRO_J, P_JARUN, PH_J3, S_ELEKTRO, 2, 'UG-2026-003', 520000, 'active', { job: 'Kompletne elektroinstalacije — obje zgrade', start: '2026-03-01', end: '2026-12-15' }),
  contract(CT_TERMO_J, P_JARUN, PH_J3, S_TERMO, 3, 'UG-2026-004', 610000, 'active', { job: 'ViK, podno grijanje i dizalice topline', start: '2026-03-15', end: '2026-12-31' }),
  contract(CT_ALU_J, P_JARUN, PH_J4, S_ALU, 4, 'UG-2026-009', 480000, 'draft', { job: 'ALU stolarija i staklene stijene', start: '2026-11-01', end: '2027-02-28' }),
  contract(CT_MODUL_J, P_JARUN, PH_J2, S_MODUL, 6, 'UG-2025-002', 280000, 'active', { job: 'Glavni projekt, izvedbeni projekt i projektantski nadzor', start: '2025-03-01', end: '2027-06-30' }),
  contract(CT_KROV_J, P_JARUN, PH_J2, S_KROV, 1, 'UG-2026-012', 190000, 'draft', { job: 'Krovište, limarija i hidroizolacija', start: '2026-09-01', end: '2026-11-15' }),
  contract(CT_ISKOP_J, P_JARUN, PH_J1, S_ISKOP, 1, 'UG-2025-004', 268000, 'completed', { job: 'Pripremni radovi, iskop i odvoz — Jarun', start: '2025-03-10', end: '2025-06-10' }),
  contract(CT_ISKOP_M, P_MARJAN, PH_M1, S_ISKOP, 1, 'UG-2025-021', 168000, 'completed', { job: 'Pripremni radovi i iskop — Vila Marjan', start: '2025-09-10', end: '2025-12-15' }),
  contract(CT_TEHNO_M, P_MARJAN, PH_M2, S_TEHNO, 1, 'UG-2026-001', 980000, 'active', { job: 'Grubi građevinski radovi — Vila Marjan', start: '2026-01-10', end: '2026-11-30' }),
  contract(CT_KERAMIKA_M, P_MARJAN, PH_M3, S_KERAMIKA, 5, 'UG-2026-010', 260000, 'draft', { job: 'Keramičarski i kamenoklesarski radovi', start: '2026-10-01', end: '2027-02-15' }),
  contract(CT_TEHNO_T, P_TRESNJEVKA, PH_T1, S_TEHNO, 1, 'UG-2023-006', 1450000, 'completed', { job: 'Gradnja stambene zgrade — svi građevinski radovi', start: '2023-06-01', end: '2025-05-31' }),
  contract(CT_ELEKTRO_T, P_TRESNJEVKA, PH_T2, S_ELEKTRO, 2, 'UG-2023-009', 310000, 'completed', { job: 'Elektroinstalacije', start: '2024-01-15', end: '2025-04-30' }),
])

const M_TEHNO_J1 = uid(), M_TEHNO_J2 = uid(), M_TEHNO_J3 = uid(), M_TEHNO_J4 = uid(), M_TEHNO_J5 = uid(), M_TEHNO_J6 = uid()
const M_ELEKTRO_J1 = uid(), M_ELEKTRO_J2 = uid(), M_TERMO_J1 = uid(), M_TERMO_J2 = uid(), M_TEHNO_M1 = uid(), M_TEHNO_M2 = uid()
const M_MOD_J1 = uid(), M_ISK_J1 = uid(), M_ISK_M1 = uid(), M_TEHNO_T1 = uid(), M_ELEKTRO_T1 = uid()
await ins('subcontractor_milestones', [
  // Tehnogradnja — Jarun (90% physically done: 4 paid situacije + 1 completed)
  { id: M_TEHNO_J1, contract_id: CT_TEHNO_J, milestone_number: 1, milestone_name: '1. privremena situacija — iskop i temelji', percentage: 15, status: 'paid', due_date: '2025-08-01', completed_date: '2025-07-25', paid_date: '2025-08-20' },
  { id: M_TEHNO_J2, contract_id: CT_TEHNO_J, milestone_number: 2, milestone_name: '2. privremena situacija — AB konstrukcija podrum i prizemlje', percentage: 20, status: 'paid', due_date: '2025-12-15', completed_date: '2025-12-05', paid_date: '2026-01-10' },
  { id: M_TEHNO_J3, contract_id: CT_TEHNO_J, milestone_number: 3, milestone_name: '3. privremena situacija — AB konstrukcija Zgrada A', percentage: 20, status: 'paid', due_date: '2026-05-31', completed_date: '2026-06-10', paid_date: '2026-07-10' },
  { id: M_TEHNO_J4, contract_id: CT_TEHNO_J, milestone_number: 4, milestone_name: '4. privremena situacija — AB konstrukcija Zgrada B do 3. kata', percentage: 25, status: 'paid', due_date: '2026-06-30', completed_date: '2026-06-28', paid_date: '2026-07-05' },
  { id: M_TEHNO_J6, contract_id: CT_TEHNO_J, milestone_number: 5, milestone_name: '5. privremena situacija — fasada i krovna ploča Zgrada A', percentage: 10, status: 'completed', due_date: '2026-07-31', completed_date: '2026-07-12' },
  { id: M_TEHNO_J5, contract_id: CT_TEHNO_J, milestone_number: 6, milestone_name: 'Okončana situacija', percentage: 10, status: 'pending', due_date: '2026-10-15' },
  // Elektro-Instal — Jarun (55% done, both situacije paid)
  { id: M_ELEKTRO_J1, contract_id: CT_ELEKTRO_J, milestone_number: 1, milestone_name: '1. situacija — gruba instalacija Zgrada A', percentage: 30, status: 'paid', due_date: '2026-05-15', completed_date: '2026-05-10', paid_date: '2026-06-01' },
  { id: M_ELEKTRO_J2, contract_id: CT_ELEKTRO_J, milestone_number: 2, milestone_name: '2. situacija — gruba instalacija Zgrada B', percentage: 25, status: 'paid', due_date: '2026-07-10', completed_date: '2026-07-08', paid_date: '2026-07-12' },
  { id: uid(), contract_id: CT_ELEKTRO_J, milestone_number: 3, milestone_name: '3. situacija — završna montaža i ormari', percentage: 45, status: 'pending', due_date: '2026-11-30' },
  // Termo-Vod — Jarun (50% done; 2. situacija completed ali NEPLAĆENA — dospjeli račun)
  { id: M_TERMO_J1, contract_id: CT_TERMO_J, milestone_number: 1, milestone_name: '1. situacija — razvod ViK podrum', percentage: 30, status: 'paid', due_date: '2026-06-15', completed_date: '2026-06-12', paid_date: '2026-06-30' },
  { id: M_TERMO_J2, contract_id: CT_TERMO_J, milestone_number: 2, milestone_name: '2. situacija — podno grijanje prizemlje Zgrada A', percentage: 20, status: 'completed', due_date: '2026-07-01', completed_date: '2026-06-28' },
  { id: uid(), contract_id: CT_TERMO_J, milestone_number: 3, milestone_name: '3. situacija — dizalice topline i završna montaža', percentage: 50, status: 'pending', due_date: '2026-12-15' },
  // Studio Modul — Jarun (65% done: projekt plaćen, nadzor u tijeku)
  { id: M_MOD_J1, contract_id: CT_MODUL_J, milestone_number: 1, milestone_name: 'Glavni i izvedbeni projekt', percentage: 40, status: 'paid', due_date: '2025-05-31', completed_date: '2025-05-20', paid_date: '2025-06-15' },
  { id: uid(), contract_id: CT_MODUL_J, milestone_number: 2, milestone_name: 'Projektantski nadzor — gruba gradnja', percentage: 25, status: 'completed', due_date: '2026-09-30', completed_date: '2026-07-01' },
  { id: uid(), contract_id: CT_MODUL_J, milestone_number: 3, milestone_name: 'Nadzor do primopredaje', percentage: 35, status: 'pending', due_date: '2027-06-30' },
  // Iskop-Trans — pripremne faze (100% done → završene faze nose punu ostvarenu vrijednost)
  { id: M_ISK_J1, contract_id: CT_ISKOP_J, milestone_number: 1, milestone_name: 'Okončana situacija — pripremni radovi', percentage: 100, status: 'paid', due_date: '2025-06-15', completed_date: '2025-06-10', paid_date: '2025-07-05' },
  { id: M_ISK_M1, contract_id: CT_ISKOP_M, milestone_number: 1, milestone_name: 'Okončana situacija — pripremni radovi', percentage: 100, status: 'paid', due_date: '2025-12-20', completed_date: '2025-12-15', paid_date: '2026-01-15' },
  // Tehnogradnja — Marjan (55% done: 1. plaćena, 2. dovršena)
  { id: M_TEHNO_M1, contract_id: CT_TEHNO_M, milestone_number: 1, milestone_name: '1. privremena situacija — temelji', percentage: 30, status: 'paid', due_date: '2026-04-30', completed_date: '2026-04-22', paid_date: '2026-05-15' },
  { id: M_TEHNO_M2, contract_id: CT_TEHNO_M, milestone_number: 2, milestone_name: '2. privremena situacija — AB konstrukcija prizemlje', percentage: 25, status: 'completed', due_date: '2026-07-15', completed_date: '2026-07-10' },
  { id: uid(), contract_id: CT_TEHNO_M, milestone_number: 3, milestone_name: 'Okončana situacija', percentage: 45, status: 'pending', due_date: '2026-11-30' },
  // Trešnjevka — dovršen projekt, sve situacije plaćene
  { id: M_TEHNO_T1, contract_id: CT_TEHNO_T, milestone_number: 1, milestone_name: 'Situacije 1–6 — gradnja (zbirno)', percentage: 80, status: 'paid', due_date: '2025-03-31', completed_date: '2025-03-20', paid_date: '2025-04-20' },
  { id: uid(), contract_id: CT_TEHNO_T, milestone_number: 2, milestone_name: 'Okončana situacija', percentage: 20, status: 'paid', due_date: '2025-06-15', completed_date: '2025-05-31', paid_date: '2025-06-15' },
  { id: M_ELEKTRO_T1, contract_id: CT_ELEKTRO_T, milestone_number: 1, milestone_name: 'Okončana situacija — elektroinstalacije', percentage: 100, status: 'paid', due_date: '2025-04-30', completed_date: '2025-04-25', paid_date: '2025-05-20' },
])

const wl = (date, sub, ctr, phase, project, desc, status, extra = {}) => ({
  id: uid(), date, subcontractor_id: sub, contract_id: ctr, phase_id: phase, project_id: project,
  work_description: desc, status, created_by: (supervisionUsers[0] ?? director).id, ...extra,
})
await ins('work_logs', [
  wl('2026-07-03', S_TEHNO, CT_TEHNO_J, PH_J2, P_JARUN, 'Betoniranje stropne ploče 3. kata — Zgrada B', 'work_finished'),
  wl('2026-07-04', S_ELEKTRO, CT_ELEKTRO_J, PH_J3, P_JARUN, 'Razvod instalacija 2. kat — Zgrada A', 'work_finished'),
  wl('2026-07-06', S_TEHNO, CT_TEHNO_J, PH_J2, P_JARUN, 'Armiranje zidova 4. kata — Zgrada B', 'work_finished'),
  wl('2026-07-07', S_TERMO, CT_TERMO_J, PH_J3, P_JARUN, 'Montaža razvoda podnog grijanja — prizemlje Zgrada A', 'in_progress'),
  wl('2026-07-08', S_TEHNO, CT_TEHNO_J, PH_J2, P_JARUN, 'Isporuka armature kasni — radovi na 4. katu stoje', 'blocker', { blocker_details: 'Dobavljač armature javio kašnjenje isporuke; novi termin 15.07. Prijeti pomak betoniranja za 4 dana.' }),
  wl('2026-07-09', S_ELEKTRO, CT_ELEKTRO_J, PH_J3, P_JARUN, 'Gruba instalacija 3. kat — Zgrada A', 'work_finished'),
  wl('2026-07-10', S_TERMO, CT_TERMO_J, PH_J3, P_JARUN, 'Tlačna proba ViK vertikala — Zgrada A', 'work_finished'),
  wl('2026-07-10', S_TEHNO, CT_TEHNO_M, PH_M2, P_MARJAN, 'Oplata AB zidova — južno krilo', 'in_progress'),
  wl('2026-07-11', S_TEHNO, CT_TEHNO_J, PH_J2, P_JARUN, 'Priprema oplate stropne ploče 4. kata — Zgrada B', 'in_progress'),
  wl('2026-07-11', S_TEHNO, CT_TEHNO_M, PH_M2, P_MARJAN, 'Betoniranje temelja bazena', 'work_finished'),
])

// ---------- 6. SALES: buildings, units, customers, sales ----------

const BLD_JA = uid(), BLD_JB = uid(), BLD_M = uid(), BLD_T = uid()
await ins('buildings', [
  { id: BLD_JA, project_id: P_JARUN, name: 'Zgrada A', total_floors: 6, description: 'Zapadna zgrada — pogled na jezero' },
  { id: BLD_JB, project_id: P_JARUN, name: 'Zgrada B', total_floors: 6, description: 'Istočna zgrada' },
  { id: BLD_M, project_id: P_MARJAN, name: 'Vila Marjan', total_floors: 3, description: 'Ekskluzivna vila s bazenom' },
  { id: BLD_T, project_id: P_TRESNJEVKA, name: 'Zgrada A', total_floors: 4, description: 'Dovršena i predana zgrada' },
])

// Customers (10 buyers + 2 interested + 2 leads)
const custIds = Array.from({ length: 14 }, () => uid())
const customersData = [
  ['Ana', 'Kovač', 'buyer', 'ana.kovac@gmail.com', '+385 91 111 2001'],
  ['Marko', 'Babić', 'buyer', 'marko.babic@gmail.com', '+385 98 111 2002'],
  ['Petra', 'Novak', 'buyer', 'petra.novak@gmail.com', '+385 95 111 2003'],
  ['Ivan', 'Marić', 'buyer', 'ivan.maric@gmail.com', '+385 91 111 2004'],
  ['Lucija', 'Jurić', 'buyer', 'lucija.juric@gmail.com', '+385 99 111 2005'],
  ['Tomislav', 'Horvat', 'buyer', 'tomislav.horvat@gmail.com', '+385 91 111 2006'],
  ['Maja', 'Vidović', 'buyer', 'maja.vidovic@gmail.com', '+385 98 111 2007'],
  ['Davor', 'Perić', 'buyer', 'davor.peric@gmail.com', '+385 95 111 2008'],
  ['Martina', 'Šarić', 'buyer', 'martina.saric@gmail.com', '+385 91 111 2009'],
  ['Hrvoje', 'Pavić', 'buyer', 'hrvoje.pavic@gmail.com', '+385 99 111 2010'],
  ['Sandra', 'Radić', 'interested', 'sandra.radic@gmail.com', '+385 91 111 2011'],
  ['Krešimir', 'Tomić', 'interested', 'kresimir.tomic@gmail.com', '+385 98 111 2012'],
  ['Nikolina', 'Grgić', 'lead', 'nikolina.grgic@gmail.com', '+385 95 111 2013'],
  ['Filip', 'Matković', 'lead', 'filip.matkovic@gmail.com', '+385 91 111 2014'],
]
await ins('customers', customersData.map(([name, surname, status, email, phone], i) => ({
  id: custIds[i], name, surname, status, email, phone, customer_number: 1001 + i,
  priority: status === 'buyer' ? null : (status === 'interested' ? 'hot' : 'warm'),
  last_contact_date: status === 'buyer' ? null : '2026-07-0' + ((i % 9) + 1),
  notes: status === 'interested' ? 'Zanima ju trosoban stan na višem katu — poslana ponuda.' : null,
})))

// Apartments — Jarun Zgrada A (12: 7 sold, 3 reserved, 2 available)
const aptRows = []
const aptIds = {}
function apt(key, building, project, number, floor, size, ppm2, status, buyerIdx = null, extra = {}) {
  const id = uid()
  aptIds[key] = id
  aptRows.push({
    id, building_id: building, project_id: project, number, floor, size_m2: size,
    price_per_m2: ppm2, price: Math.round(size * ppm2), status,
    sobnost: size < 55 ? 2 : size < 80 ? 3 : 4, ulaz: number.startsWith('A') ? 'A' : number.startsWith('B') ? 'B' : null,
    buyer_name: buyerIdx !== null ? `${customersData[buyerIdx][0]} ${customersData[buyerIdx][1]}` : null,
    ...extra,
  })
  return id
}
// Jarun — Zgrada A
apt('JA1', BLD_JA, P_JARUN, 'A-101', 1, 48.5, 3350, 'Sold', 0, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2025-11-12', kapara_10_posto: 16247 })
apt('JA2', BLD_JA, P_JARUN, 'A-102', 1, 64.2, 3350, 'Sold', 1, { contract_payment_type: 'installments', datum_potpisa_predugovora: '2025-12-03', kapara_10_posto: 21507 })
apt('JA3', BLD_JA, P_JARUN, 'A-201', 2, 55.0, 3450, 'Sold', 2, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-01-20' })
apt('JA4', BLD_JA, P_JARUN, 'A-202', 2, 78.4, 3450, 'Sold', 3, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-02-14' })
apt('JA5', BLD_JA, P_JARUN, 'A-301', 3, 55.0, 3550, 'Sold', 4, { contract_payment_type: 'installments', datum_potpisa_predugovora: '2026-03-02' })
apt('JA6', BLD_JA, P_JARUN, 'A-302', 3, 78.4, 3550, 'Sold', 5, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-04-18' })
apt('JA7', BLD_JA, P_JARUN, 'A-401', 4, 92.6, 3650, 'Sold', 6, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-05-25' })
apt('JA8', BLD_JA, P_JARUN, 'A-402', 4, 61.3, 3650, 'Reserved', null)
apt('JA9', BLD_JA, P_JARUN, 'A-501', 5, 95.0, 3750, 'Reserved', null)
apt('JA10', BLD_JA, P_JARUN, 'A-502', 5, 66.8, 3750, 'Reserved', null)
apt('JA11', BLD_JA, P_JARUN, 'A-601', 6, 110.5, 3900, 'Available', null, { tip_stana: 'penthouse' })
apt('JA12', BLD_JA, P_JARUN, 'A-602', 6, 104.2, 3900, 'Available', null, { tip_stana: 'penthouse' })
// Jarun — Zgrada B
apt('JB1', BLD_JB, P_JARUN, 'B-101', 1, 47.9, 3250, 'Sold', 7, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-05-05' })
apt('JB2', BLD_JB, P_JARUN, 'B-102', 1, 63.5, 3250, 'Sold', 8, { contract_payment_type: 'installments', datum_potpisa_predugovora: '2026-06-01' })
apt('JB3', BLD_JB, P_JARUN, 'B-201', 2, 55.0, 3350, 'Sold', 9, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-06-20' })
apt('JB4', BLD_JB, P_JARUN, 'B-202', 2, 77.8, 3350, 'Reserved', null)
apt('JB5', BLD_JB, P_JARUN, 'B-301', 3, 55.0, 3450, 'Reserved', null)
for (const [n, floor, size, ppm2] of [['B-302', 3, 77.8, 3450], ['B-401', 4, 91.4, 3550], ['B-402', 4, 60.9, 3550], ['B-501', 5, 94.1, 3650], ['B-502', 5, 66.0, 3650], ['B-601', 6, 108.8, 3800], ['B-602', 6, 102.6, 3800]]) {
  apt(`JBav${n}`, BLD_JB, P_JARUN, n, floor, size, ppm2, 'Available', null)
}
// Marjan
apt('M1', BLD_M, P_MARJAN, 'V-01', 1, 88.0, 4600, 'Sold', 0, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-04-10' })
apt('M2', BLD_M, P_MARJAN, 'V-02', 2, 96.5, 4600, 'Sold', 6, { contract_payment_type: 'credit', datum_potpisa_predugovora: '2026-06-05' })
apt('M3', BLD_M, P_MARJAN, 'V-03', 2, 92.0, 4600, 'Reserved', null)
for (const [n, floor, size] of [['V-04', 3, 121.0], ['V-05', 3, 118.5]]) apt(`Mav${n}`, BLD_M, P_MARJAN, n, floor, size, 4800, 'Available', null)
// Trešnjevka — all sold & delivered
for (let i = 0; i < 8; i++) {
  apt(`T${i}`, BLD_T, P_TRESNJEVKA, `S-${101 + Math.floor(i / 2) * 100 + (i % 2)}`, Math.floor(i / 2) + 1, 52 + i * 6, 2950, 'Sold', i % 10)
}
await ins('apartments', aptRows)

// Garages & repositories
const garRows = [], garIds = []
for (let i = 0; i < 14; i++) {
  const id = uid(); garIds.push(id)
  garRows.push({ id, building_id: i < 8 ? BLD_JA : BLD_JB, number: `G-${String(i + 1).padStart(2, '0')}`, floor: -1, size_m2: 13.5, price: 19500 + (i % 3) * 1500, status: i < 8 ? 'Sold' : i < 10 ? 'Reserved' : 'Available' })
}
for (let i = 0; i < 4; i++) {
  const id = uid(); garIds.push(id)
  garRows.push({ id, building_id: BLD_M, number: `GM-${i + 1}`, floor: 0, size_m2: 15.0, price: 28000, status: i < 2 ? 'Sold' : 'Available' })
}
await ins('garages', garRows)

const repRows = [], repIds = []
for (let i = 0; i < 10; i++) {
  const id = uid(); repIds.push(id)
  repRows.push({ id, building_id: i < 6 ? BLD_JA : BLD_JB, number: `R-${String(i + 1).padStart(2, '0')}`, floor: -1, size_m2: 3.5 + (i % 4), price: 4200 + (i % 4) * 1300, status: i < 6 ? 'Sold' : 'Available' })
}
await ins('repositories', repRows)

// Link sold garages/repositories to sold apartments (package deals)
await ins('apartment_garages', ['JA1', 'JA2', 'JA3', 'JA4', 'JA5', 'JA6', 'JA7', 'JB1'].map((k, i) => ({ id: uid(), apartment_id: aptIds[k], garage_id: garIds[i] })))
await ins('apartment_repositories', ['JA1', 'JA2', 'JA4', 'JA6', 'JA7', 'JB2'].map((k, i) => ({ id: uid(), apartment_id: aptIds[k], repository_id: repIds[i] })))

// Sales records for sold Jarun + Marjan apartments
const saleFor = (aptKey, custIdx, saleDate, method, paidShare, extra = {}) => {
  const a = aptRows.find((r) => r.id === aptIds[aptKey])
  const price = a.price
  const paid = Math.round(price * paidShare)
  return {
    id: uid(), apartment_id: a.id, customer_id: custIds[custIdx], sale_date: saleDate,
    sale_price: price, payment_method: method, down_payment: Math.round(price * 0.1),
    monthly_payment: method === 'installments' ? Math.round((price * 0.9) / 36) : 0,
    total_paid: paid, remaining_amount: price - paid, contract_signed: true,
    next_payment_date: paidShare < 1 ? '2026-08-01' : null, ...extra,
  }
}
await ins('sales', [
  saleFor('JA1', 0, '2025-11-12', 'bank_loan', 1),
  saleFor('JA2', 1, '2025-12-03', 'installments', 0.45),
  saleFor('JA3', 2, '2026-01-20', 'bank_loan', 1),
  saleFor('JA4', 3, '2026-02-14', 'bank_loan', 0.6),
  saleFor('JA5', 4, '2026-03-02', 'installments', 0.3),
  saleFor('JA6', 5, '2026-04-18', 'bank_loan', 0.5),
  saleFor('JA7', 6, '2026-05-25', 'bank_loan', 0.1),
  saleFor('JB1', 7, '2026-05-05', 'bank_loan', 0.35),
  saleFor('JB2', 8, '2026-06-01', 'installments', 0.15),
  saleFor('JB3', 9, '2026-06-20', 'cash', 1),
  saleFor('M1', 0, '2026-04-10', 'bank_loan', 0.55),
  saleFor('M2', 6, '2026-06-05', 'bank_loan', 0.2),
])

// ---------- 7. FUNDING: credits, allocations, TIC ----------

const K_JARUN = uid(), K_OKVIRNI = uid(), K_TRESNJEVKA = uid(), K_HBOR = uid()
await ins('bank_credits', [
  { id: K_JARUN, credit_name: 'Kredit Rezidencija Jarun', bank_id: B_ZABA, company_id: C_JARUN, project_id: P_JARUN, credit_type: 'construction_loan', amount: 5000000, interest_rate: 4.1, credit_seniority: 'senior', status: 'active', start_date: '2025-05-01', maturity_date: '2028-05-01', usage_expiration_date: '2027-05-01', grace_period: 12, interest_repayment_type: 'quarterly', principal_repayment_type: 'yearly', purpose: 'Financiranje gradnje — Rezidencija Jarun (Zgrada A i B)' },
  { id: K_OKVIRNI, credit_name: 'Okvirni kredit — obrtna sredstva', bank_id: B_PBZ, company_id: C_PARENT, credit_type: 'line_of_credit', amount: 1500000, interest_rate: 5.2, credit_seniority: 'junior', status: 'active', start_date: '2026-01-15', maturity_date: '2027-01-15', interest_repayment_type: 'monthly', purpose: 'Obrtna sredstva grupe' },
  { id: K_TRESNJEVKA, credit_name: 'Kredit Trešnjevka (otplaćen)', bank_id: B_ERSTE, company_id: C_PARENT, project_id: P_TRESNJEVKA, credit_type: 'term_loan', amount: 2000000, interest_rate: 4.9, credit_seniority: 'senior', status: 'paid', repaid_amount: 2000000, start_date: '2023-06-01', maturity_date: '2026-06-01', interest_repayment_type: 'quarterly', principal_repayment_type: 'quarterly', purpose: 'Financiranje gradnje — Trešnjevka' },
  { id: K_HBOR, credit_name: 'HBOR — Kvart Črnomerec', bank_id: B_HBOR, company_id: C_PARENT, project_id: P_CRNOMEREC, credit_type: 'construction_loan', amount: 7500000, interest_rate: 2.9, credit_seniority: 'senior', status: 'active', start_date: '2026-09-01', maturity_date: '2031-09-01', usage_expiration_date: '2029-09-01', grace_period: 24, interest_repayment_type: 'biyearly', principal_repayment_type: 'yearly', purpose: 'Odobren okvir za Kvart Črnomerec — povlačenje od Q4/2026' },
])

const AL_JARUN_PROJ = uid()
await ins('credit_allocations', [
  { id: AL_JARUN_PROJ, credit_id: K_JARUN, allocation_type: 'project', project_id: P_JARUN, allocated_amount: 4000000, used_amount: 0, description: 'Gradnja — situacije izvođača' },
  { id: uid(), credit_id: K_JARUN, allocation_type: 'opex', allocated_amount: 500000, used_amount: 0, description: 'Operativni troškovi projekta' },
  { id: uid(), credit_id: K_JARUN, allocation_type: 'refinancing', refinancing_entity_type: 'company', refinancing_entity_id: C_PARENT, allocated_amount: 500000, used_amount: 0, description: 'Refinanciranje pozajmice osnivača' },
  { id: uid(), credit_id: K_OKVIRNI, allocation_type: 'opex', allocated_amount: 800000, used_amount: 0, description: 'Obrtna sredstva — grupa' },
  { id: uid(), credit_id: K_HBOR, allocation_type: 'project', project_id: P_CRNOMEREC, allocated_amount: 7500000, used_amount: 0, description: 'Cjelokupni okvir — Črnomerec' },
])

await ins('tic_cost_structures', [{
  id: uid(), project_id: P_JARUN, investor_name: 'Zagrebačka banka d.d.', document_date: '2026-05-31', created_by: director.id,
  line_items: [
    { name: 'Zemljište i pristojbe', vlastita: 1200000, kreditna: 0 },
    { name: 'Projektiranje i dozvole', vlastita: 280000, kreditna: 0 },
    { name: 'Građenje — grubi radovi', vlastita: 0, kreditna: 2800000 },
    { name: 'Instalacije', vlastita: 200000, kreditna: 1200000 },
    { name: 'Završni radovi', vlastita: 900000, kreditna: 1000000 },
    { name: 'Okoliš i priključci', vlastita: 450000, kreditna: 0 },
    { name: 'Marketing i prodaja', vlastita: 190000, kreditna: 0 },
    { name: 'Financijski troškovi', vlastita: 0, kreditna: 280000 },
  ],
}])

// Inter-company loan: parent tops up the Jarun SPV (trigger recalculates balances)
await ins('company_loans', [
  { id: uid(), from_company_id: C_PARENT, from_bank_account_id: ACC_PARENT_ZABA, to_company_id: C_JARUN, to_bank_account_id: ACC_JARUN, amount: 250000, loan_date: '2026-03-10' },
])

// ---------- 8. RETAIL ----------

const RST_GEO = uid(), RST_PROJ = uid(), RST_KOM = uid(), RST_ZEM = uid()
await ins('retail_supplier_types', [
  { id: RST_GEO, name: 'Geodetske usluge' },
  { id: RST_PROJ, name: 'Projektiranje' },
  { id: RST_KOM, name: 'Komunalna infrastruktura' },
  { id: RST_ZEM, name: 'Zemljani radovi' },
])

const RS_GEO = uid(), RS_URB = uid(), RS_CESTO = uid(), RS_ELMR = uid()
await ins('retail_suppliers', [
  { id: RS_GEO, name: 'Geo-Premjer d.o.o.', supplier_type_id: RST_GEO, oib: '66778899001', contact_person: 'Zoran Lovrić', contact_phone: '+385 91 300 4001' },
  { id: RS_URB, name: 'Urbanistički studio Osijek d.o.o.', supplier_type_id: RST_PROJ, oib: '77889900112', contact_person: 'Vesna Šimunović', contact_phone: '+385 91 300 4002' },
  { id: RS_CESTO, name: 'Cestogradnja Slavonija d.o.o.', supplier_type_id: RST_KOM, oib: '88990011223', contact_person: 'Mario Đurić', contact_phone: '+385 91 300 4003' },
  { id: RS_ELMR, name: 'Elektra-Mreža d.o.o.', supplier_type_id: RST_KOM, oib: '99001122334', contact_person: 'Robert Galić', contact_phone: '+385 91 300 4004' },
])

const RC_OPG = uid(), RC_AUTO = uid(), RC_SARIC = uid(), RC_LOGI = uid()
await ins('retail_customers', [
  { id: RC_OPG, name: 'OPG Marić', oib: '10203040506', contact_phone: '+385 98 400 5001' },
  { id: RC_AUTO, name: 'Autokuća Ferenčić d.o.o.', oib: '20304050607', contact_phone: '+385 98 400 5002' },
  { id: RC_SARIC, name: 'Ivan i Marija Šarić', oib: '30405060708', contact_phone: '+385 98 400 5003' },
  { id: RC_LOGI, name: 'Logistika Panon d.o.o.', oib: '40506070809', contact_phone: '+385 98 400 5004' },
])

const LP_VRB1 = uid(), LP_VRB2 = uid(), LP_SAM = uid()
await ins('retail_land_plots', [
  { id: LP_VRB1, plot_number: 'k.č. 1234/5 k.o. Vrbovec', location: 'Vrbovec — poslovna zona', owner_first_name: 'Josip', owner_last_name: 'Vrban', total_area_m2: 12500, purchased_area_m2: 12500, price_per_m2: 18, payment_status: 'paid', payment_date: '2025-10-15' },
  { id: LP_VRB2, plot_number: 'k.č. 887/2 k.o. Vrbovec', location: 'Vrbovec — proširenje zone', owner_first_name: 'Štefica', owner_last_name: 'Kolarić', total_area_m2: 8200, purchased_area_m2: 8200, price_per_m2: 16, payment_status: 'partial', payment_date: null },
  { id: LP_SAM, plot_number: 'k.č. 2201 k.o. Samobor', location: 'Samobor — stambena zona', owner_first_name: 'Branko', owner_last_name: 'Fabijanić', total_area_m2: 15000, purchased_area_m2: 15000, price_per_m2: 32, payment_status: 'paid', payment_date: '2026-02-28' },
])

const RP_VRBOVEC = uid(), RP_SAMOBOR = uid()
await ins('retail_projects', [
  { id: RP_VRBOVEC, name: 'Poslovna zona Vrbovec', location: 'Vrbovec', plot_number: 'k.č. 1234/5', land_plot_id: LP_VRB1, total_area_m2: 12500, purchase_price: 225000, status: 'In Progress', start_date: '2025-10-15', notes: 'Parcelacija na 8 građevinskih parcela za malo gospodarstvo.' },
  { id: RP_SAMOBOR, name: 'Stambene parcele Samobor', location: 'Samobor', plot_number: 'k.č. 2201', land_plot_id: LP_SAM, total_area_m2: 15000, purchase_price: 480000, status: 'Planning', start_date: '2026-03-01', notes: 'U izradi parcelacijski elaborat — 12 stambenih parcela.' },
])

const RPH_VRB_DEV = uid(), RPH_VRB_INFRA = uid(), RPH_VRB_SALES = uid(), RPH_SAM_DEV = uid()
await ins('retail_project_phases', [
  { id: RPH_VRB_DEV, project_id: RP_VRBOVEC, phase_order: 1, phase_name: 'Otkup zemljišta i parcelacija', phase_type: 'development', status: 'Completed', budget_allocated: 260000, start_date: '2025-10-15', end_date: '2026-03-31' },
  { id: RPH_VRB_INFRA, project_id: RP_VRBOVEC, phase_order: 2, phase_name: 'Komunalna infrastruktura', phase_type: 'construction', status: 'In Progress', budget_allocated: 380000, start_date: '2026-04-15' },
  { id: RPH_VRB_SALES, project_id: RP_VRBOVEC, phase_order: 3, phase_name: 'Prodaja parcela', phase_type: 'sales', status: 'In Progress', budget_allocated: 25000, start_date: '2026-06-01' },
  { id: RPH_SAM_DEV, project_id: RP_SAMOBOR, phase_order: 1, phase_name: 'Parcelacija i dozvole', phase_type: 'development', status: 'In Progress', budget_allocated: 95000, start_date: '2026-03-01' },
])

const RCON_INFRA = uid()
await ins('retail_contracts', [
  { id: RCON_INFRA, contract_number: 'RU-2026-01', phase_id: RPH_VRB_INFRA, supplier_id: RS_CESTO, contract_amount: 300000, status: 'Active', has_contract: true, contract_date: '2026-04-10', start_date: '2026-04-15', notes: 'Ceste, oborinska odvodnja i javna rasvjeta u zoni.', budget_realized: 0, total_invoices_amount: 0 },
  { id: uid(), contract_number: 'RU-2025-07', phase_id: RPH_VRB_DEV, supplier_id: RS_GEO, contract_amount: 18500, status: 'Completed', has_contract: true, contract_date: '2025-11-05', start_date: '2025-11-10', end_date: '2026-01-20', notes: 'Geodetski elaborat parcelacije.', budget_realized: 18500, total_invoices_amount: 18500 },
  { id: uid(), contract_number: 'RU-2026-03', phase_id: RPH_SAM_DEV, supplier_id: RS_URB, contract_amount: 42000, status: 'Active', has_contract: true, contract_date: '2026-03-15', start_date: '2026-03-20', notes: 'Urbanistički plan i parcelacijski elaborat.', budget_realized: 0, total_invoices_amount: 0 },
])

const RM_INFRA1 = uid(), RM_INFRA2 = uid(), RM_INFRA3 = uid()
await ins('retail_contract_milestones', [
  { id: RM_INFRA1, contract_id: RCON_INFRA, milestone_number: 1, milestone_name: '1. situacija — zemljani radovi i trasiranje', percentage: 40, status: 'pending', due_date: '2026-06-30', description: 'Iskolčenje, iskopi i posteljica internih prometnica' },
  { id: RM_INFRA2, contract_id: RCON_INFRA, milestone_number: 2, milestone_name: '2. situacija — oborinska odvodnja i cestovna konstrukcija', percentage: 40, status: 'pending', due_date: '2026-08-31' },
  { id: RM_INFRA3, contract_id: RCON_INFRA, milestone_number: 3, milestone_name: 'Okončana situacija — javna rasvjeta i asfaltiranje', percentage: 20, status: 'pending', due_date: '2026-10-31' },
])

await ins('retail_sales', [
  { id: uid(), customer_id: RC_OPG, land_plot_id: LP_VRB1, phase_id: RPH_VRB_SALES, contract_number: 'KP-2026-11', sale_area_m2: 2400, sale_price_per_m2: 32, paid_amount: 40000, payment_status: 'partial', payment_deadline: '2026-09-01' },
  { id: uid(), customer_id: RC_AUTO, land_plot_id: LP_VRB1, phase_id: RPH_VRB_SALES, contract_number: 'KP-2026-14', sale_area_m2: 3100, sale_price_per_m2: 35, paid_amount: 108500, payment_status: 'paid', payment_deadline: '2026-07-01' },
  { id: uid(), customer_id: RC_LOGI, land_plot_id: LP_VRB1, phase_id: RPH_VRB_SALES, contract_number: 'KP-2026-17', sale_area_m2: 4200, sale_price_per_m2: 30, paid_amount: 0, payment_status: 'pending', payment_deadline: '2026-10-15' },
])

// ---------- 9. CASHFLOW: categories, office suppliers, invoices, payments ----------

const catNames = ['Građevinski radovi', 'Elektroinstalacije', 'Instalacije ViK', 'Materijal', 'Projektiranje i nadzor', 'Uredski troškovi', 'Marketing', 'Bankovne naknade', 'Prodaja stanova', 'Ostalo']
await ins('invoice_categories', catNames.map((name, i) => ({ id: uid(), name, is_active: true, sort_order: i + 1 })))

const OS_HEP = uid(), OS_HT = uid(), OS_URED = uid()
await ins('office_suppliers', [
  { id: OS_HEP, name: 'HEP Opskrba d.o.o.', tax_id: '63073332379', email: 'kupci@hep.hr' },
  { id: OS_HT, name: 'Hrvatski Telekom d.d.', tax_id: '81793146560', email: 'poslovni@t.ht.hr' },
  { id: OS_URED, name: 'Uredski centar d.o.o.', tax_id: '11223344556', email: 'prodaja@uredski-centar.hr' },
])

// Invoice helper — amounts via base_amount_1/2/4; DB trigger computes VAT + totals.
const invoices = []
const inv = (key, o) => {
  const id = uid()
  invoices.push({
    id, status: 'UNPAID', paid_amount: 0, remaining_amount: 0, // trigger recomputes
    base_amount: 0, vat_amount: 0, total_amount: 0, vat_rate: 25,
    base_amount_1: 0, base_amount_2: 0, base_amount_3: 0, base_amount_4: 0,
    vat_rate_1: 25, vat_rate_2: 13, vat_rate_3: 0, vat_rate_4: 5,
    approved: true, created_by: authId, ...o,
  })
  invIds[key] = id
  return id
}
const invIds = {}

// — Jarun subcontractor invoices (situacije)
inv('I_TG_J1', { invoice_number: 'TG-2025-118', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_JARUN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_J, milestone_id: M_TEHNO_J1, project_id: P_JARUN, base_amount_1: 336000, issue_date: '2025-07-28', due_date: '2025-08-27', description: '1. privremena situacija — iskop i temelji', iban: 'HR9123600001500011111' })
inv('I_TG_J2', { invoice_number: 'TG-2025-201', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_JARUN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_J, milestone_id: M_TEHNO_J2, project_id: P_JARUN, base_amount_1: 448000, issue_date: '2025-12-08', due_date: '2026-01-07', description: '2. privremena situacija — AB konstrukcija podrum i prizemlje', iban: 'HR9123600001500011111' })
inv('I_TG_J3', { invoice_number: 'TG-2026-097', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_JARUN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_J, milestone_id: M_TEHNO_J3, project_id: P_JARUN, base_amount_1: 448000, issue_date: '2026-06-12', due_date: '2026-07-12', description: '3. privremena situacija — AB konstrukcija Zgrada A', iban: 'HR9123600001500011111' })
inv('I_EL_J1', { invoice_number: 'EI-2026-054', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Elektroinstalacije', company_id: C_JARUN, supplier_id: S_ELEKTRO, contract_id: CT_ELEKTRO_J, milestone_id: M_ELEKTRO_J1, project_id: P_JARUN, base_amount_1: 156000, issue_date: '2026-05-12', due_date: '2026-06-11', description: '1. situacija — gruba instalacija Zgrada A' })
inv('I_EL_J2', { invoice_number: 'EI-2026-078', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Elektroinstalacije', company_id: C_JARUN, supplier_id: S_ELEKTRO, contract_id: CT_ELEKTRO_J, milestone_id: M_ELEKTRO_J2, project_id: P_JARUN, base_amount_1: 130000, issue_date: '2026-07-09', due_date: '2026-07-25', description: '2. situacija — gruba instalacija Zgrada B' })
inv('I_TV_J1', { invoice_number: 'TV-2026-041', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Instalacije ViK', company_id: C_JARUN, supplier_id: S_TERMO, contract_id: CT_TERMO_J, milestone_id: M_TERMO_J1, project_id: P_JARUN, base_amount_1: 183000, issue_date: '2026-06-15', due_date: '2026-06-20', description: '1. situacija — razvod ViK podrum' })
inv('I_TV_J2', { invoice_number: 'TV-2026-058', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Instalacije ViK', company_id: C_JARUN, supplier_id: S_TERMO, contract_id: CT_TERMO_J, milestone_id: M_TERMO_J2, project_id: P_JARUN, base_amount_1: 122000, issue_date: '2026-06-28', due_date: '2026-07-01', description: '2. situacija — podno grijanje prizemlje (DOSPJELO)' })
inv('I_TG_J4', { invoice_number: 'TG-2026-118', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_JARUN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_J, milestone_id: M_TEHNO_J4, project_id: P_JARUN, base_amount_1: 560000, issue_date: '2026-06-30', due_date: '2026-07-30', description: '4. privremena situacija — AB konstrukcija Zgrada B do 3. kata' })
inv('I_TG_J5', { invoice_number: 'TG-2026-131', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_JARUN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_J, milestone_id: M_TEHNO_J6, project_id: P_JARUN, base_amount_1: 224000, issue_date: '2026-07-13', due_date: '2026-08-12', description: '5. privremena situacija — fasada i krovna ploča Zgrada A' })
inv('I_MOD_J0', { invoice_number: 'MOD-2025-11', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Projektiranje i nadzor', company_id: C_JARUN, supplier_id: S_MODUL, contract_id: CT_MODUL_J, milestone_id: M_MOD_J1, project_id: P_JARUN, base_amount_1: 112000, issue_date: '2025-05-25', due_date: '2025-06-24', description: 'Glavni i izvedbeni projekt — Rezidencija Jarun' })
inv('I_ISK_J', { invoice_number: 'IT-2025-044', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_JARUN, supplier_id: S_ISKOP, contract_id: CT_ISKOP_J, milestone_id: M_ISK_J1, project_id: P_JARUN, base_amount_1: 268000, issue_date: '2025-06-12', due_date: '2025-07-12', description: 'Okončana situacija — pripremni radovi i iskop' })
inv('I_ISK_M', { invoice_number: 'IT-2025-098', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_MARJAN, supplier_id: S_ISKOP, contract_id: CT_ISKOP_M, milestone_id: M_ISK_M1, project_id: P_MARJAN, base_amount_1: 168000, issue_date: '2025-12-16', due_date: '2026-01-15', description: 'Okončana situacija — pripremni radovi Vila Marjan' })
inv('I_TG_M3', { invoice_number: 'TG-2026-115', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_MARJAN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_M, project_id: P_MARJAN, base_amount_1: 260000, issue_date: '2026-06-25', due_date: '2026-07-25', description: 'Avansni račun — materijal za AB konstrukciju' })
inv('I_MOD_J', { invoice_number: 'MOD-2026-07', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Projektiranje i nadzor', company_id: C_JARUN, supplier_id: S_MODUL, contract_id: CT_MODUL_J, project_id: P_JARUN, base_amount_1: 14000, issue_date: '2026-06-30', due_date: '2026-07-05', description: 'Projektantski nadzor — lipanj 2026.' })
// — Multi-VAT showcase invoice (25% + 13% + 5% on one invoice)
inv('I_KER_M', { invoice_number: 'KP-2026-112', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Materijal', company_id: C_MARJAN, supplier_id: S_KERAMIKA, project_id: P_MARJAN, base_amount_1: 42000, base_amount_2: 18000, base_amount_4: 6000, issue_date: '2026-06-25', due_date: '2026-07-25', description: 'Keramika i kamen — kombinirane stope PDV-a (25% / 13% / 5%)' })
// — Marjan situacije (cesija + kompenzacija showcases)
inv('I_TG_M1', { invoice_number: 'TG-2026-044', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_MARJAN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_M, milestone_id: M_TEHNO_M1, project_id: P_MARJAN, base_amount_1: 294000, issue_date: '2026-04-24', due_date: '2026-05-24', description: '1. privremena situacija — temelji (plaćeno cesijom preko matice)' })
inv('I_TG_M2', { invoice_number: 'TG-2026-101', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_MARJAN, supplier_id: S_TEHNO, contract_id: CT_TEHNO_M, project_id: P_MARJAN, base_amount_1: 196000, issue_date: '2026-06-20', due_date: '2026-07-20', description: 'Dodatni radovi — potporni zid (djelomično kompenzacija)' })
// — Trešnjevka historical
inv('I_TG_T', { invoice_number: 'TG-2025-089', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_PARENT, supplier_id: S_TEHNO, contract_id: CT_TEHNO_T, project_id: P_TRESNJEVKA, base_amount_1: 290000, issue_date: '2025-05-20', due_date: '2025-06-19', description: 'Okončana situacija — Trešnjevka' })
inv('I_TG_T2', { invoice_number: 'TG-2025-030', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Građevinski radovi', company_id: C_PARENT, supplier_id: S_TEHNO, contract_id: CT_TEHNO_T, milestone_id: M_TEHNO_T1, project_id: P_TRESNJEVKA, base_amount_1: 1160000, issue_date: '2025-03-25', due_date: '2025-04-24', description: 'Situacije 1–6 zbirno — gradnja Trešnjevka' })
inv('I_EL_T', { invoice_number: 'EI-2025-021', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', category: 'Elektroinstalacije', company_id: C_PARENT, supplier_id: S_ELEKTRO, contract_id: CT_ELEKTRO_T, milestone_id: M_ELEKTRO_T1, project_id: P_TRESNJEVKA, base_amount_1: 310000, issue_date: '2025-04-28', due_date: '2025-05-28', description: 'Okončana situacija — elektroinstalacije Trešnjevka' })
// — Office invoices (HEP monthly Jan–Jun for dashboard trends, HT, office supplies)
const hepMonths = ['01', '02', '03', '04', '05', '06']
for (const m of hepMonths) {
  inv(`I_HEP_${m}`, { invoice_number: `HEP-2026-${m}-8841`, invoice_type: 'INCOMING_OFFICE', invoice_category: 'OFFICE', category: 'Uredski troškovi', company_id: C_PARENT, office_supplier_id: OS_HEP, base_amount_2: 3840, issue_date: `2026-${m}-08`, due_date: `2026-${m}-22`, description: `Električna energija — ${m}/2026` })
}
inv('I_HT', { invoice_number: 'HT-2026-06-5512', invoice_type: 'INCOMING_OFFICE', invoice_category: 'OFFICE', category: 'Uredski troškovi', company_id: C_PARENT, office_supplier_id: OS_HT, base_amount_1: 1290, issue_date: '2026-06-10', due_date: '2026-06-24', description: 'Telekomunikacijske usluge — lipanj' })
inv('I_URED', { invoice_number: 'UC-2026-0788', invoice_type: 'INCOMING_OFFICE', invoice_category: 'OFFICE', category: 'Uredski troškovi', company_id: C_PARENT, office_supplier_id: OS_URED, base_amount_1: 2450, issue_date: '2026-07-01', due_date: '2026-07-31', description: 'Uredski materijal i oprema' })
// — Bank invoices (interest + fee on Jarun credit)
inv('I_KAM_Q2', { invoice_number: 'ZABA-K-2026-Q2', invoice_type: 'INCOMING_BANK', invoice_category: 'BANK_CREDIT', category: 'Bankovne naknade', company_id: C_JARUN, bank_id: B_ZABA, bank_credit_id: K_JARUN, base_amount_3: 51250, issue_date: '2026-06-30', due_date: '2026-07-15', description: 'Kamata Q2/2026 — Kredit Rezidencija Jarun' })
inv('I_NAKN', { invoice_number: 'ZABA-N-2026-071', invoice_type: 'INCOMING_BANK', invoice_category: 'BANK_CREDIT', category: 'Bankovne naknade', company_id: C_JARUN, bank_id: B_ZABA, bank_credit_id: K_JARUN, base_amount_3: 1200, issue_date: '2026-07-01', due_date: '2026-07-10', description: 'Naknada za vođenje kredita' })
// — Outgoing sales invoices (buyer payments per apartment)
inv('I_OUT_ANA1', { invoice_number: 'IZL-2025-014', invoice_type: 'OUTGOING_SALES', invoice_category: 'CUSTOMER', category: 'Prodaja stanova', company_id: C_JARUN, customer_id: custIds[0], apartment_id: aptIds['JA1'], project_id: P_JARUN, base_amount_1: 13000, issue_date: '2025-11-12', due_date: '2025-11-26', description: 'Kapara 10% — stan A-101' })
inv('I_OUT_ANA2', { invoice_number: 'IZL-2026-031', invoice_type: 'OUTGOING_SALES', invoice_category: 'CUSTOMER', category: 'Prodaja stanova', company_id: C_JARUN, customer_id: custIds[0], apartment_id: aptIds['JA1'], project_id: P_JARUN, base_amount_1: 117000, issue_date: '2026-02-10', due_date: '2026-03-10', description: 'Isplata po kreditu banke — stan A-101' })
inv('I_OUT_MARKO', { invoice_number: 'IZL-2025-019', invoice_type: 'OUTGOING_SALES', invoice_category: 'CUSTOMER', category: 'Prodaja stanova', company_id: C_JARUN, customer_id: custIds[1], apartment_id: aptIds['JA2'], project_id: P_JARUN, base_amount_1: 17205, issue_date: '2025-12-03', due_date: '2025-12-17', description: 'Kapara 10% — stan A-102' })
inv('I_OUT_MARKO2', { invoice_number: 'IZL-2026-044', invoice_type: 'OUTGOING_SALES', invoice_category: 'CUSTOMER', category: 'Prodaja stanova', company_id: C_JARUN, customer_id: custIds[1], apartment_id: aptIds['JA2'], project_id: P_JARUN, base_amount_1: 54400, issue_date: '2026-05-15', due_date: '2026-06-15', description: 'Rata 1 — AB konstrukcija 30% — stan A-102' })
inv('I_OUT_PETRA', { invoice_number: 'IZL-2026-052', invoice_type: 'OUTGOING_SALES', invoice_category: 'CUSTOMER', category: 'Prodaja stanova', company_id: C_JARUN, customer_id: custIds[2], apartment_id: aptIds['JA3'], project_id: P_JARUN, base_amount_1: 15180, issue_date: '2026-07-01', due_date: '2026-07-30', description: 'Kapara 10% — stan A-201' })
// — Retail invoices
inv('I_RET_CESTO', { invoice_number: 'CS-2026-201', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'RETAIL', category: 'Građevinski radovi', company_id: C_PARENT, retail_supplier_id: RS_CESTO, retail_project_id: RP_VRBOVEC, retail_contract_id: RCON_INFRA, retail_milestone_id: RM_INFRA1, base_amount_1: 96000, issue_date: '2026-05-30', due_date: '2026-06-29', description: '1. situacija — komunalna infrastruktura Vrbovec' })
inv('I_RET_CESTO2', { invoice_number: 'CS-2026-233', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'RETAIL', category: 'Građevinski radovi', company_id: C_PARENT, retail_supplier_id: RS_CESTO, retail_project_id: RP_VRBOVEC, retail_contract_id: RCON_INFRA, retail_milestone_id: RM_INFRA2, base_amount_1: 72000, issue_date: '2026-07-06', due_date: '2026-08-05', description: '2. situacija — komunalna infrastruktura Vrbovec' })

await ins('accounting_invoices', invoices)

// Payments — triggers derive invoice status, contract realizacija, balances, credit usage.
const pays = []
const pay = (invKey, amount, date, o = {}) => pays.push({
  id: uid(), invoice_id: invIds[invKey], amount, payment_date: date, payment_method: 'WIRE',
  payment_source_type: 'bank_account', created_by: authId, ...o,
})
// Jarun subcontractors — regular bank-account payments (total = base * 1.25)
pay('I_TG_J1', 420000, '2025-08-20', { company_bank_account_id: ACC_JARUN, description: 'Plaćanje 1. situacije' })
pay('I_TG_J2', 560000, '2026-01-10', { company_bank_account_id: ACC_JARUN, description: 'Plaćanje 2. situacije' })
// 3. situacija — partially paid, and paid FROM THE CREDIT LINE (drawdown showcase)
pay('I_TG_J3', 300000, '2026-07-02', { payment_source_type: 'credit', credit_id: K_JARUN, credit_allocation_id: AL_JARUN_PROJ, description: 'Djelomično — povlačenje iz kredita ZABA' })
pay('I_TG_J3', 260000, '2026-07-10', { payment_source_type: 'credit', credit_id: K_JARUN, credit_allocation_id: AL_JARUN_PROJ, description: 'Ostatak 3. situacije — povlačenje iz kredita ZABA' })
pay('I_TG_J4', 700000, '2026-07-05', { payment_source_type: 'credit', credit_id: K_JARUN, credit_allocation_id: AL_JARUN_PROJ, description: '4. situacija — povlačenje iz kredita ZABA' })
pay('I_EL_J2', 162500, '2026-07-12', { company_bank_account_id: ACC_JARUN })
pay('I_TV_J1', 228750, '2026-06-30', { company_bank_account_id: ACC_JARUN })
pay('I_MOD_J0', 140000, '2025-06-15', { company_bank_account_id: ACC_JARUN, description: 'Projekt — Studio Modul' })
pay('I_ISK_J', 335000, '2025-07-05', { company_bank_account_id: ACC_JARUN })
pay('I_ISK_M', 210000, '2026-01-15', { company_bank_account_id: ACC_MARJAN })
pay('I_TG_M3', 325000, '2026-06-30', { company_bank_account_id: ACC_MARJAN, description: 'Avans za materijal' })
pay('I_TG_T2', 1450000, '2025-04-20', { payment_source_type: 'credit', credit_id: K_TRESNJEVKA, description: 'Situacije 1–6 — iz kredita Erste' })
pay('I_EL_T', 387500, '2025-05-20', { payment_source_type: 'credit', credit_id: K_TRESNJEVKA, description: 'Elektroinstalacije — iz kredita Erste' })
pay('I_EL_J1', 195000, '2026-06-01', { company_bank_account_id: ACC_JARUN })
pay('I_MOD_J', 0.0 + 17500, '2026-07-06', { company_bank_account_id: ACC_JARUN, description: 'Nadzor — lipanj' })
// Multi-VAT invoice — paid
pay('I_KER_M', 79140, '2026-07-03', { company_bank_account_id: ACC_MARJAN })
// CESIJA showcase — parent company pays Marjan's invoice
pay('I_TG_M1', 367500, '2026-05-15', { is_cesija: true, cesija_company_id: C_PARENT, cesija_bank_account_id: ACC_PARENT_ZABA, description: 'Cesija — Adriatic Development plaća za AD Projekt Marjan' })
// KOMPENZACIJA showcase — partial offset
pay('I_TG_M2', 100000, '2026-07-08', { payment_source_type: 'kompenzacija', description: 'Kompenzacija — prijeboj po izjavi KOMP-2026-07' })
pay('I_TG_M2', 145000, '2026-07-12', { company_bank_account_id: ACC_MARJAN, description: 'Ostatak nakon kompenzacije' })
// Trešnjevka historical
pay('I_TG_T', 362500, '2025-06-15', { company_bank_account_id: ACC_PARENT_ZABA })
// Office invoices — HEP paid monthly (one CASH for variety), HT paid
for (const m of hepMonths) pay(`I_HEP_${m}`, 4339.2, `2026-${m}-20`, { company_bank_account_id: ACC_PARENT_PBZ, description: `HEP ${m}/2026` })
pay('I_HT', 1612.5, '2026-06-20', { payment_method: 'CASH', payment_source_type: 'gotovina', description: 'Plaćeno gotovinom' })
// Bank interest paid
pay('I_KAM_Q2', 51250, '2026-07-10', { company_bank_account_id: ACC_JARUN, description: 'Kamata Q2' })
pay('I_NAKN', 1200, '2026-07-08', { company_bank_account_id: ACC_JARUN })
// Buyer payments (money in)
pay('I_OUT_ANA1', 16250, '2025-11-20', { company_bank_account_id: ACC_JARUN, description: 'Kapara — Ana Kovač' })
pay('I_OUT_ANA2', 146250, '2026-03-05', { company_bank_account_id: ACC_JARUN, description: 'Isplata kredita banke kupca' })
pay('I_OUT_MARKO', 21506.25, '2025-12-10', { company_bank_account_id: ACC_JARUN })
pay('I_OUT_MARKO2', 40000, '2026-06-10', { company_bank_account_id: ACC_JARUN, description: 'Djelomična uplata rate 1' })
// Retail infra — first situacija paid
pay('I_RET_CESTO', 120000, '2026-06-25', { company_bank_account_id: ACC_PARENT_ZABA })

await ins('accounting_payments', pays)

await ins('monthly_budgets', [1, 2, 3, 4, 5, 6, 7, 8].map((m) => ({
  id: uid(), year: 2026, month: m, budget_amount: [380000, 350000, 420000, 460000, 520000, 480000, 450000, 500000][m - 1],
  notes: m === 7 ? 'Uključuje planirano povlačenje kredita za situacije' : null,
})))

// ---------- 10. TASKS ----------

// Task user columns hold AUTH user ids (schema shared with the mobile task app).
const task = (title, o = {}) => ({
  id: uid(), title, description: o.description ?? '', description_format: 'plain',
  completed: o.done ?? false, created_by: o.by ?? director.auth_user_id, project_id: o.project ?? null,
  deadline: o.due ?? null, is_private: o.private ?? false,
  completed_at: o.done ? '2026-07-10T10:00:00Z' : null,
})
const taskRows = [
  task('Pripremiti dokumentaciju za tehnički pregled — Zgrada A', { project: P_JARUN, due: '2026-08-20', description: 'Atesti, izjave izvođača i geodetski snimak izvedenog stanja.' }),
  task('Ovjeriti 3. situaciju Tehnogradnje kod nadzora', { project: P_JARUN, due: '2026-07-18', by: (supervisionUsers[0] ?? director).auth_user_id }),
  task('Poslati ponude za stanove B-202 i B-301 rezerviranim kupcima', { project: P_JARUN, due: '2026-07-16', by: salesUser.auth_user_id }),
  task('Dogovoriti termin s HBOR-om za Črnomerec', { project: P_CRNOMEREC, due: '2026-07-25' }),
  task('Produžiti policu osiguranja gradilišta Marjan', { project: P_MARJAN, due: '2026-07-31' }),
  task('Objaviti oglase za penthouse stanove A-601 i A-602', { project: P_JARUN, done: true, by: salesUser.auth_user_id }),
  task('Kontrola troškova — usporedba TIC vs. realizacija za Q2', { project: P_JARUN, done: true }),
  task('Pripremiti materijale za sastanak uprave', { due: '2026-07-15', private: true }),
]
await ins('tasks', taskRows)
await ins('task_assignees', [
  { id: uid(), task_id: taskRows[1].id, assignee_id: (supervisionUsers[0] ?? director).auth_user_id },
  { id: uid(), task_id: taskRows[2].id, assignee_id: salesUser.auth_user_id },
  { id: uid(), task_id: taskRows[0].id, assignee_id: director.auth_user_id },
])

// ---------- summary ----------

// Recompute phase budget_used from active/draft contracts (mirrors recalculate_all_phase_budgets;
// the RPC is blocked through PostgREST by the no-WHERE-clause guard, so do it per phase).
const { data: phaseContracts, error: pcErr } = await db.from('contracts').select('phase_id, contract_amount, status').in('status', ['active', 'draft'])
if (pcErr) throw new Error(`fetch contracts for phase budgets: ${pcErr.message}`)
const usedByPhase = {}
for (const c of phaseContracts) {
  if (!c.phase_id) continue
  usedByPhase[c.phase_id] = (usedByPhase[c.phase_id] ?? 0) + Number(c.contract_amount)
}
for (const [phaseId, used] of Object.entries(usedByPhase)) {
  const { error } = await db.from('project_phases').update({ budget_used: used }).eq('id', phaseId)
  if (error) throw new Error(`update phase budget ${phaseId}: ${error.message}`)
}
console.log(`  ~ recalculated budget_used for ${Object.keys(usedByPhase).length} phases`)

console.log('\nDone. Verifying counts…')
const tables = ['projects', 'project_phases', 'project_milestones', 'subcontractors', 'contracts', 'subcontractor_milestones', 'work_logs', 'buildings', 'apartments', 'garages', 'repositories', 'customers', 'sales', 'accounting_companies', 'company_bank_accounts', 'banks', 'bank_credits', 'credit_allocations', 'accounting_invoices', 'accounting_payments', 'invoice_categories', 'monthly_budgets', 'retail_projects', 'retail_contracts', 'retail_sales', 'tasks']
for (const t of tables) {
  const { count, error } = await db.from(t).select('*', { count: 'exact', head: true })
  console.log(`  ${t}: ${error ? 'ERR ' + error.message : count}`)
}
console.log('\nSeed complete.')
