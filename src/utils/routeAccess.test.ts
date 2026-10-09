import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CASHFLOW_ROUTES, DIRECTOR_ROUTES, PAYMENT_ROUTES, SUPERVISION_ROLE_ROUTES, canRoleAccessRoute } from './routeAccess'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

/** Every `<Route path=… element={…} />` in App.tsx, with the guard its element is wrapped in. */
function routesInApp(): { path: string; guard: 'cashflow' | 'director' | null }[] {
  const source = read('src/App.tsx')
  return [...source.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)].map(match => ({
    path: match[1],
    guard: match[2].includes('<CashflowRoute>') ? 'cashflow' : match[2].includes('<DirectorRoute>') ? 'director' : null,
  }))
}

describe('the lists match the router', () => {
  const routes = routesInApp()

  it('finds the routes at all', () => {
    expect(routes.length).toBeGreaterThan(40)
  })

  it('lists exactly the routes wrapped in <CashflowRoute>', () => {
    const guarded = routes.filter(route => route.guard === 'cashflow').map(route => route.path)
    expect([...CASHFLOW_ROUTES].sort()).toEqual(guarded.sort())
  })

  it('lists every route wrapped in <DirectorRoute>, plus the self-guarding Activity Log', () => {
    const guarded = routes.filter(route => route.guard === 'director').map(route => route.path)
    expect([...DIRECTOR_ROUTES].sort()).toEqual([...guarded, '/activity-log'].sort())
    expect(read('src/components/General/ActivityLog/index.tsx')).toContain('canViewActivityLog(user)')
  })

  it('lists the Funding payments register, which guards itself and is offered in the menu on the same test', () => {
    expect([...PAYMENT_ROUTES]).toEqual(['/funding-payments'])
    expect(read('src/components/Funding/Payments/index.tsx')).toContain('canManagePayments(user)')
    expect(read('src/components/Common/Layout.tsx')).toMatch(/canManagePayments\(user\)[\s\S]{0,80}path: '\/funding-payments'/)
    expect(canRoleAccessRoute('Accounting', '/funding-payments')).toBe(true)
    expect(canRoleAccessRoute('Investment', '/funding-payments')).toBe(false)
    expect(canRoleAccessRoute('Sales', '/funding-payments')).toBe(false)
  })

  it('gives the Supervision role the three menu items Layout does', () => {
    const layout = read('src/components/Common/Layout.tsx')
    const block = layout.slice(layout.indexOf("if (user?.role === 'Supervision') {"))
    const menu = [...block.slice(0, block.indexOf(']')).matchAll(/path: '([^']+)'/g)].map(match => match[1])
    expect(menu).toEqual(['/site-management', '/work-logs', '/documents'])
    for (const path of menu) expect(SUPERVISION_ROLE_ROUTES).toContain(path)
  })
})

describe('canRoleAccessRoute', () => {
  it('keeps Cashflow pages to Director and Accounting', () => {
    expect(canRoleAccessRoute('Director', '/accounting-invoices')).toBe(true)
    expect(canRoleAccessRoute('Accounting', '/debt-status')).toBe(true)
    expect(canRoleAccessRoute('Sales', '/accounting-invoices')).toBe(false)
    expect(canRoleAccessRoute('Investment', '/accounting-payments')).toBe(false)
  })

  it('keeps Director pages to the Director', () => {
    expect(canRoleAccessRoute('Director', '/activity-log')).toBe(true)
    expect(canRoleAccessRoute('Accounting', '/general-reports')).toBe(false)
  })

  it('lets every other role open unguarded pages, with or without route params', () => {
    expect(canRoleAccessRoute('Sales', '/budget-control')).toBe(true)
    expect(canRoleAccessRoute('Sales', '/tic')).toBe(true)
    expect(canRoleAccessRoute('Investment', '/projects/:id')).toBe(true)
    expect(canRoleAccessRoute('Sales', '/projects/42')).toBe(true)
  })

  it('limits the Supervision role to the pages it is offered', () => {
    expect(canRoleAccessRoute('Supervision', '/site-management/:projectId?')).toBe(true)
    expect(canRoleAccessRoute('Supervision', '/work-logs')).toBe(true)
    expect(canRoleAccessRoute('Supervision', '/calendar')).toBe(true)
    expect(canRoleAccessRoute('Supervision', '/payments')).toBe(false)
    expect(canRoleAccessRoute('Supervision', '/tic')).toBe(false)
  })

  it('grants nothing without a role', () => {
    expect(canRoleAccessRoute(null, '/projects')).toBe(false)
  })
})
