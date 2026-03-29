import { describe, it, expect } from 'vitest'
import { PineStaticAnalyzer, AnalyzerDiagnostic } from '../src/PineStaticAnalyzer'

function analyze(code: string): AnalyzerDiagnostic[] {
  return new PineStaticAnalyzer(code).analyze()
}

describe('PineStaticAnalyzer', () => {
  describe('v6-only check', () => {
    it('returns empty for v5 scripts', () => {
      const code = `//@version=5
indicator("test")
a = array.from(1,2,3)
array.get(a, 5)
`
      expect(analyze(code)).toEqual([])
    })

    it('returns empty for scripts with no version', () => {
      const code = `indicator("test")
a = array.from(1,2,3)
array.get(a, 5)
`
      expect(analyze(code)).toEqual([])
    })

    it('works on v6 scripts', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.get(a, 5)
`
      const diags = analyze(code)
      expect(diags.length).toBeGreaterThan(0)
    })
  })

  describe('literal index OOB', () => {
    it('flags index >= size', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.get(a, 5)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(1)
      expect(diags[0].severity).toBe('error')
      expect(diags[0].message).toContain('Index 5 out of bounds')
      expect(diags[0].message).toContain('size 3')
      expect(diags[0].line).toBe(4)
    })

    it('allows valid index', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.get(a, 2)
`
      const diags = analyze(code).filter(d => d.severity === 'error')
      expect(diags).toHaveLength(0)
    })

    it('flags exact boundary (index == size)', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.get(a, 3)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(1)
      expect(diags[0].severity).toBe('error')
      expect(diags[0].message).toContain('Index 3 out of bounds')
    })

    it('handles negative index OOB', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.get(a, -4)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(1)
      expect(diags[0].severity).toBe('error')
      expect(diags[0].message).toContain('Negative index -4 out of bounds')
    })

    it('allows valid negative index', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.get(a, -3)
`
      const diags = analyze(code).filter(d => d.severity === 'error')
      expect(diags).toHaveLength(0)
    })
  })

  describe('off-by-one with array.size()', () => {
    it('flags array.get(a, array.size(a))', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
array.get(a, array.size(a))
`
      const diags = analyze(code)
      const offByOne = diags.filter(d => d.message.includes('Off-by-one'))
      expect(offByOne).toHaveLength(1)
      expect(offByOne[0].severity).toBe('error')
      expect(offByOne[0].message).toContain('size as index')
    })
  })

  describe('unguarded .first()/.last()', () => {
    it('warns on unguarded .first() with zero-size array', () => {
      const code = `//@version=6
indicator("test")
a = array.new<float>(0)
x = array.first(a)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'warning' && d.message.includes('Unguarded'))
      expect(warns).toHaveLength(1)
    })

    it('is silent when size guard exists', () => {
      const code = `//@version=6
indicator("test")
a = array.new<float>(0)
if array.size(a) > 0
    x = array.first(a)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'warning' && d.message.includes('Unguarded'))
      expect(warns).toHaveLength(0)
    })

    it('does not warn when array has known non-zero size', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
x = array.first(a)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'warning' && d.message.includes('Unguarded'))
      expect(warns).toHaveLength(0)
    })
  })

  describe('loop bounds mismatch', () => {
    it('warns when loop bound is not from array.size()', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
for i = 0 to 10
    array.get(a, i)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'warning' && d.message.includes('Loop variable'))
      expect(warns).toHaveLength(1)
    })

    it('is silent when bound is array.size() - 1', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
for i = 0 to array.size(a) - 1
    array.get(a, i)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'warning' && d.message.includes('Loop variable'))
      expect(warns).toHaveLength(0)
    })

    it('is silent when bound variable is derived from array.size()', () => {
      const code = `//@version=6
indicator("test")
a = array.from(1,2,3)
n = array.size(a) - 1
for i = 0 to n
    array.get(a, i)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'warning' && d.message.includes('Loop variable'))
      expect(warns).toHaveLength(0)
    })
  })

  describe('int/float as bool warning', () => {
    it('warns on if myInt', () => {
      const code = `//@version=6
indicator("test")
int x = 5
if x
    label.new(bar_index, high)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('Implicit bool cast'))
      expect(warns).toHaveLength(1)
      expect(warns[0].severity).toBe('warning')
      expect(warns[0].message).toContain("!= 0")
    })

    it('does not warn on if x > 0', () => {
      const code = `//@version=6
indicator("test")
int x = 5
if x > 0
    label.new(bar_index, high)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('Implicit bool cast'))
      expect(warns).toHaveLength(0)
    })

    it('warns on float used as bool', () => {
      const code = `//@version=6
indicator("test")
float val = 1.5
if val
    label.new(bar_index, high)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('Implicit bool cast'))
      expect(warns).toHaveLength(1)
    })
  })
})
