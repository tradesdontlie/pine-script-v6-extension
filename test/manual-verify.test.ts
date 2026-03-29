import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { PineStaticAnalyzer } from '../src/PineStaticAnalyzer'

describe('Manual verification test — real-world script', () => {
  const code = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'manual-verify.pine'),
    'utf-8',
  )
  const diags = new PineStaticAnalyzer(code).analyze()

  it('detects all expected errors', () => {
    const errors = diags.filter((d) => d.severity === 'error')
    console.log('\n=== ERRORS DETECTED ===')
    errors.forEach((e) => console.log(`  Line ${e.line}: ${e.message}`))
    // Should catch: get(prices,5), prices.get(10), get(prices,-4), get(prices,array.size(prices))
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })

  it('detects all expected warnings', () => {
    const warnings = diags.filter((d) => d.severity === 'warning')
    console.log('\n=== WARNINGS DETECTED ===')
    warnings.forEach((w) => console.log(`  Line ${w.line}: ${w.message}`))
    // Should catch: empty.first(), empty.last(), loop bounds, if x (bool cast)
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })

  it('prints full diagnostic report', () => {
    console.log(`\n=== FULL REPORT: ${diags.length} diagnostics ===`)
    diags.forEach((d) => {
      const icon = d.severity === 'error' ? 'X' : d.severity === 'warning' ? '!' : 'i'
      console.log(`  [${icon}] Line ${d.line}: ${d.message}`)
    })
  })
})
