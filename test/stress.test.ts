import { describe, it, expect } from 'vitest'
import { PineStaticAnalyzer } from '../src/PineStaticAnalyzer'

describe('PineStaticAnalyzer stress tests', () => {
  it('analyzes a 1000-line script under 2 seconds', () => {
    const lines: string[] = ['//@version=6', 'indicator("stress")']

    // Create 50 arrays
    for (let i = 0; i < 50; i++) {
      lines.push(`arr${i} = array.from(${Array.from({ length: 5 }, (_, j) => j).join(',')})`)
    }

    // Generate many lines of code (mix of valid and invalid accesses)
    while (lines.length < 1000) {
      const arrIdx = lines.length % 50
      const accessIdx = lines.length % 7 // some will be OOB (>= 5)
      lines.push(`x${lines.length} = array.get(arr${arrIdx}, ${accessIdx})`)
    }

    const code = lines.join('\n')
    expect(code.split('\n').length).toBeGreaterThanOrEqual(1000)

    const start = performance.now()
    const diags = new PineStaticAnalyzer(code).analyze()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(2000)
    expect(diags.length).toBeGreaterThan(0)
  })

  it('detects 100+ errors correctly', () => {
    const lines: string[] = ['//@version=6', 'indicator("many errors")']
    lines.push('a = array.from(1,2,3)')

    // 150 OOB accesses
    for (let i = 0; i < 150; i++) {
      lines.push(`x${i} = array.get(a, ${i + 3})`)
    }

    const code = lines.join('\n')
    const diags = new PineStaticAnalyzer(code).analyze()
    const errors = diags.filter(d => d.severity === 'error')
    expect(errors.length).toBeGreaterThanOrEqual(100)
  })

  it('empty arrays do not crash', () => {
    const code = `//@version=6
indicator("empty")
a = array.new<float>(0)
b = array.from()
`
    expect(() => new PineStaticAnalyzer(code).analyze()).not.toThrow()
  })
})
