import { randomUUID } from 'node:crypto'

export const runId: string =
  process.env.E2E_RUN_ID ?? `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`

if (!process.env.E2E_RUN_ID) {
  process.env.E2E_RUN_ID = runId
}

export function testNamespace(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${runId}-${slug}`
}
