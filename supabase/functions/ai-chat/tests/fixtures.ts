// The seeded world every characterisation test starts from.
//
// The financial fixtures are built around the correctness rules the AI chat
// exists to get right (see docs/AI_CHAT.md, "Data-model landmines"):
//
//   - P_TIC has a TIC, so its projects.budget is TIC-derived.
//   - P_LEGACY has NO TIC but still carries a hand-typed projects.budget from
//     before the TIC became the only budget source (20260909140000).
//   - P_UNPLANNED has no TIC and no budget at all.
//   - P_TIC has ONE phase (as most projects do) whose budget_used is stale.
//   - P_TIC's two contracts sit in the same phase but different cost
//     classifications: phase does not separate spend categories,
//     classification does.
//   - INV_LAND matches the financial summary's invoice filter by BOTH paths
//     (direct project_id and via its contract), to pin the dedupe.

import type { FakeSupabase } from './fake-supabase.ts'

export const SERVICE_ROLE_KEY = 'fake-service-role-key'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const TOKENS = {
  director: 'tok-director',
  accounting: 'tok-accounting',
  sales: 'tok-sales',
  supervision: 'tok-supervision',
  investment: 'tok-investment',
  orphan: 'tok-orphan', // valid auth user, no public.users row
}

export const USERS = {
  director: { id: uuid(101), authId: uuid(201), role: 'Director', email: 'direktor@test.hr' },
  accounting: { id: uuid(102), authId: uuid(202), role: 'Accounting', email: 'racunovodstvo@test.hr' },
  sales: { id: uuid(103), authId: uuid(203), role: 'Sales', email: 'prodaja@test.hr' },
  supervision: { id: uuid(104), authId: uuid(204), role: 'Supervision', email: 'nadzor@test.hr' },
  investment: { id: uuid(105), authId: uuid(205), role: 'Investment', email: 'investicije@test.hr' },
}
const ORPHAN_AUTH_ID = uuid(299)

export const P_TIC = uuid(1)
export const P_LEGACY = uuid(2)
export const P_UNPLANNED = uuid(3)
export const PH_TIC_1 = uuid(11)
export const CC_LAND = uuid(21)
export const CC_BUILD = uuid(22)
export const CC_RETIRED = uuid(23)
export const SC_BUILDER = uuid(31)
export const SC_ELECTRIC = uuid(32)
export const CT_LAND = uuid(41)
export const CT_BUILD = uuid(42)
export const CT_UNPLANNED = uuid(43)
export const INV_LAND = uuid(51)
export const INV_BUILD = uuid(52)
export const INV_UNPLANNED = uuid(53)

export const STALE_BUDGET_USED = 999_999

export function seedWorld(db: FakeSupabase): void {
  for (const [key, u] of Object.entries(USERS)) {
    db.authUsers[TOKENS[key as keyof typeof TOKENS]] = { id: u.authId, email: u.email }
  }
  db.authUsers[TOKENS.orphan] = { id: ORPHAN_AUTH_ID, email: 'nitko@test.hr' }
  db.seed('users', Object.values(USERS).map((u) => ({ id: u.id, auth_user_id: u.authId, role: u.role, email: u.email })))
  db.seed('project_managers', [
    { id: uuid(61), user_id: USERS.supervision.id, project_id: P_TIC, assigned_at: '2026-01-10T00:00:00Z' },
  ])

  db.seed('projects', [
    { id: P_TIC, name: 'Funtana', location: 'Funtana', status: 'In Progress', budget: 1_200_000 },
    { id: P_LEGACY, name: 'Prečko zapad', location: 'Zagreb', status: 'Planning', budget: 500_000 },
    { id: P_UNPLANNED, name: 'Kopko', location: 'Osijek', status: 'Planning', budget: null },
  ])
  db.seed('tic_cost_structures', [{ id: uuid(71), project_id: P_TIC, line_items: [] }])
  db.seed('project_phases', [{
    id: PH_TIC_1,
    project_id: P_TIC,
    phase_number: 1,
    phase_name: 'Faza 1',
    status: 'In Progress',
    start_date: '2026-01-01',
    end_date: '2027-06-30',
    budget_allocated: 1_200_000,
    budget_used: STALE_BUDGET_USED,
  }])
  db.seed('cost_classifications', [
    { id: CC_LAND, name: 'Zemljište', description: null, sort_order: 1, is_system: true, is_active: true },
    { id: CC_BUILD, name: 'Izgradnja i uređenje', description: null, sort_order: 3, is_system: true, is_active: true },
    { id: CC_RETIRED, name: 'Stara stavka', description: null, sort_order: 9, is_system: false, is_active: false },
  ])
  db.seed('subcontractors', [
    { id: SC_BUILDER, name: 'Građevinar d.o.o.', contact: '01 111 222', active_contracts_count: 2 },
    { id: SC_ELECTRIC, name: 'Elektro Horvat obrt', contact: '01 333 444', active_contracts_count: 1 },
  ])
  const contract = (c: Record<string, unknown>) => ({
    status: 'active', signed: true, has_contract: true, start_date: null, end_date: null,
    total_invoices_amount: 0, job_description: null, ...c,
  })
  db.seed('contracts', [
    contract({
      id: CT_LAND, contract_number: 'UG-1', project_id: P_TIC, phase_id: PH_TIC_1, classification_id: CC_LAND,
      subcontractor_id: SC_BUILDER, contract_amount: 400_000, budget_realized: 350_000, signed_date: '2026-02-01',
    }),
    contract({
      id: CT_BUILD, contract_number: 'UG-2', project_id: P_TIC, phase_id: PH_TIC_1, classification_id: CC_BUILD,
      subcontractor_id: SC_ELECTRIC, contract_amount: 600_000, budget_realized: 150_000, signed_date: '2026-03-01',
    }),
    contract({
      id: CT_UNPLANNED, contract_number: 'UG-3', project_id: P_UNPLANNED, phase_id: null, classification_id: CC_BUILD,
      subcontractor_id: SC_BUILDER, contract_amount: 80_000, budget_realized: 20_000, signed_date: '2026-04-01',
    }),
  ])
  db.seed('accounting_invoices', [
    {
      id: INV_LAND, invoice_number: 'R-1', project_id: P_TIC, contract_id: CT_LAND, supplier_id: SC_BUILDER,
      total_amount: 100_000, paid_amount: 100_000, remaining_amount: 0, status: 'PAID', due_date: '2026-03-01', issue_date: '2026-02-01',
    },
    {
      id: INV_BUILD, invoice_number: 'R-2', project_id: null, contract_id: CT_BUILD, supplier_id: SC_ELECTRIC,
      total_amount: 50_000, paid_amount: 20_000, remaining_amount: 30_000, status: 'PARTIALLY_PAID', due_date: '2026-04-01', issue_date: '2026-03-01',
    },
    {
      id: INV_UNPLANNED, invoice_number: 'R-3', project_id: P_UNPLANNED, contract_id: CT_UNPLANNED, supplier_id: SC_BUILDER,
      total_amount: 20_000, paid_amount: 0, remaining_amount: 20_000, status: 'UNPAID', due_date: '2026-05-01', issue_date: '2026-04-01',
    },
  ])
}
