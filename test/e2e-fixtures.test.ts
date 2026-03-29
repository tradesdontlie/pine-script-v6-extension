import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { PineStaticAnalyzer } from '../src/PineStaticAnalyzer'

describe('E2E fixture tests', () => {
  function analyzeFixture(name: string) {
    const code = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8')
    return new PineStaticAnalyzer(code).analyze()
  }

  describe('v6-array-oob.pine', () => {
    it('produces errors for OOB accesses', () => {
      const diags = analyzeFixture('v6-array-oob.pine')
      const errors = diags.filter(d => d.severity === 'error')
      expect(errors.length).toBeGreaterThanOrEqual(3)
    })
    it('produces warnings for unguarded access and loop bounds', () => {
      const diags = analyzeFixture('v6-array-oob.pine')
      const warnings = diags.filter(d => d.severity === 'warning')
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('v6-all-features.pine', () => {
    it('produces zero errors on valid v6 code', () => {
      const diags = analyzeFixture('v6-all-features.pine')
      const errors = diags.filter(d => d.severity === 'error')
      expect(errors).toHaveLength(0)
    })
  })
})
