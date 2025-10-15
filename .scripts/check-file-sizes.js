#!/usr/bin/env node

import { readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'

const MAX_LINES = 400
const FEATURES_DIR = './src/features'

function countNonEmptyLines(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  return lines.filter(line => line.trim().length > 0 && !line.trim().startsWith('//')).length
}

function checkDirectory(dir, violations = []) {
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      checkDirectory(fullPath, violations)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const lineCount = countNonEmptyLines(fullPath)
      if (lineCount > MAX_LINES) {
        violations.push({
          file: fullPath,
          lines: lineCount,
          excess: lineCount - MAX_LINES
        })
      }
    }
  }

  return violations
}

console.log('🔍 Checking file sizes in features directory...\n')

const violations = checkDirectory(FEATURES_DIR)

if (violations.length > 0) {
  console.error('❌ File size violations found:\n')
  violations.forEach(({ file, lines, excess }) => {
    console.error(`  ${file}: ${lines} lines (${excess} over limit)`)
  })
  console.error(`\n💡 Maximum allowed: ${MAX_LINES} lines per file`)
  process.exit(1)
} else {
  console.log('✅ All files are within size limits!')
  process.exit(0)
}
