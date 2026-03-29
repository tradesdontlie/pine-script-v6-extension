import { describe, it, expect } from 'vitest'
import { PineStaticAnalyzer, AnalyzerDiagnostic } from '../src/PineStaticAnalyzer'

function analyze(code: string): AnalyzerDiagnostic[] {
  return new PineStaticAnalyzer(code).analyze()
}

describe('PineStaticAnalyzer edge cases', () => {
  describe('method syntax', () => {
    it('flags a.get(10) on known array', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
x = a.get(10)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(1)
      expect(diags[0].severity).toBe('error')
      expect(diags[0].message).toContain('Index 10 out of bounds')
    })

    it('flags a.set(10, val) on known array', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
a.set(10, 99)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(1)
      expect(diags[0].severity).toBe('error')
    })
  })

  describe('array.set OOB', () => {
    it('flags array.set with OOB index', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.set(a, 5, 99)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(1)
      expect(diags[0].severity).toBe('error')
      expect(diags[0].message).toContain('Index 5 out of bounds')
    })
  })

  describe('multiple independent arrays', () => {
    it('tracks sizes independently', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2)
b = array.from(1,2,3,4,5)
array.get(a, 4)
array.get(b, 4)
`
      const diags = analyze(code)
      // a has size 2, index 4 is OOB; b has size 5, index 4 is valid
      expect(diags).toHaveLength(1)
      expect(diags[0].message).toContain("'a'")
    })
  })

  describe('empty script', () => {
    it('handles empty string', () => {
      expect(analyze('')).toEqual([])
    })

    it('handles script with no arrays', () => {
      const code = `//@version=6
indicator("test")
plot(close)
`
      expect(analyze(code)).toEqual([])
    })
  })

  describe('array.new with zero size + first()', () => {
    it('warns on first() after array.new(0)', () => {
      const code = `//@version=6
indicator("test")
a = array.new<float>(0)
x = a.first()
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'warning' && d.message.includes('Unguarded'))
      expect(warns).toHaveLength(1)
    })
  })

  describe('non-array variable with .get()', () => {
    it('does not produce false positive', () => {
      const code = `//@version=6
indicator("test")
m = map.new<string, float>()
m.get("key")
`
      // 'm' is not in the arrays map, so no diagnostic
      const diags = analyze(code)
      expect(diags).toHaveLength(0)
    })
  })

  describe('array.from single element', () => {
    it('correctly sizes single-element array', () => {
      const code = `//@version=6
indicator("test")
a = array.from(42)
array.get(a, 0)
array.get(a, 1)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(1)
      expect(diags[0].message).toContain('Index 1 out of bounds')
      expect(diags[0].message).toContain('size 1')
    })
  })

  describe('for...in loop', () => {
    it('should NOT warn on for...in', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
for val in a
    label.new(bar_index, val)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('Loop variable'))
      expect(warns).toHaveLength(0)
    })
  })

  describe('method syntax off-by-one', () => {
    it('flags a.get(a.size())', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
x = a.get(a.size())
`
      const diags = analyze(code)
      const offByOne = diags.filter(d => d.message.includes('Off-by-one'))
      expect(offByOne).toHaveLength(1)
    })
  })
})
