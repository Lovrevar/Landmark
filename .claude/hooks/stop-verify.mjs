#!/usr/bin/env node
// Stop hook: before Claude ends a turn that changed src/, run the typecheck and the tests
// related to the changed files. On failure, exit 2 — Claude receives stderr and carries on.
// Blocks at most once per turn (stop_hook_active); CI is the full check.
import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
if (input.stop_hook_active) process.exit(0)

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' })
const changed = [
  ...git('diff --name-only HEAD').split('\n'),
  ...git('ls-files --others --exclude-standard').split('\n'),
].filter((f) => /^src\/.*\.(ts|tsx)$/.test(f) && existsSync(f))
if (changed.length === 0) process.exit(0)

// Skip when nothing changed since the last green run.
const stampDir = 'node_modules/.cache'
const stampFile = `${stampDir}/stop-verify`
const hash = createHash('sha1').update(git('diff HEAD -- src')).update(changed.join('\n')).digest('hex')
if (existsSync(stampFile) && readFileSync(stampFile, 'utf8') === hash) process.exit(0)

const tail = (s, n = 60) => s.split('\n').slice(-n).join('\n')
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' })

const tsc = run('npm', ['run', '-s', 'typecheck'])
if (tsc.status !== 0) {
  process.stderr.write(`Typecheck fails — fix it before finishing:\n${tail(tsc.stdout + tsc.stderr)}\n`)
  process.exit(2)
}

const tests = run('npx', ['vitest', 'related', '--run', ...changed])
if (tests.status !== 0) {
  process.stderr.write(`Tests related to your changes fail — fix the code, not the test, unless the test is wrong (then say why):\n${tail(tests.stdout + tests.stderr)}\n`)
  process.exit(2)
}

mkdirSync(stampDir, { recursive: true })
writeFileSync(stampFile, hash)
process.exit(0)
