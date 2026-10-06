// Role gating for tool dispatch.
//
// selectAvailableTools decides which tools are advertised to the model;
// findAvailableTool is what dispatch uses to resolve the name the model sent
// back. The two must agree, or a tool could run for a role that was never
// shown it.
//
// Run: `deno test _shared/tools.test.ts` from supabase/functions/.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import type { Role } from './auth.ts'
import { findAvailableTool, selectAvailableTools, TOOLS } from './tools.ts'

const ROLES: Role[] = ['Director', 'Accounting', 'Sales', 'Supervision', 'Investment']

Deno.test('dispatch resolves every tool for each role it lists', () => {
  for (const tool of TOOLS) {
    for (const role of tool.requiredRoles) {
      assertEquals(findAvailableTool({ role }, tool.name)?.name, tool.name, `${role} → ${tool.name}`)
    }
  }
})

Deno.test('dispatch refuses a real tool for a role it does not list', () => {
  let checked = 0
  for (const tool of TOOLS) {
    for (const role of ROLES.filter((r) => !tool.requiredRoles.includes(r))) {
      assertEquals(findAvailableTool({ role }, tool.name), undefined, `${role} must not get ${tool.name}`)
      checked++
    }
  }
  // Guard against the test passing vacuously if every tool became all-roles.
  assert(checked > 0)
})

Deno.test('a Sales user cannot dispatch a finance tool', () => {
  assertEquals(findAvailableTool({ role: 'Sales' }, 'get_project_financial_summary'), undefined)
  assertEquals(findAvailableTool({ role: 'Sales' }, 'list_payments_for_subcontractor'), undefined)
})

Deno.test('dispatch refuses unknown names', () => {
  assertEquals(findAvailableTool({ role: 'Director' }, 'drop_all_tables'), undefined)
  assertEquals(findAvailableTool({ role: 'Director' }, ''), undefined)
})

Deno.test('what dispatch accepts is exactly what is advertised', () => {
  for (const role of ROLES) {
    const advertised = selectAvailableTools({ role }).map((t) => t.name).sort()
    const dispatchable = TOOLS.filter((t) => findAvailableTool({ role }, t.name)).map((t) => t.name).sort()
    assertEquals(dispatchable, advertised, role)
  }
})
