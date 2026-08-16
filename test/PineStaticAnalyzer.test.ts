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

  describe('repaint risk', () => {
    it('warns on lookahead_on with no offset', () => {
      const code = `//@version=6
indicator("test")
x = request.security(syminfo.tickerid, "D", close, lookahead = barmerge.lookahead_on)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('lookahead bias'))
      expect(warns).toHaveLength(1)
      expect(warns[0].severity).toBe('warning')
    })

    it('is silent when lookahead_on is offset', () => {
      const code = `//@version=6
indicator("test")
x = request.security(syminfo.tickerid, "D", close[1], lookahead = barmerge.lookahead_on)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('lookahead bias'))
      expect(warns).toHaveLength(0)
    })

    it('warns on bare unoffset series with no lookahead', () => {
      const code = `//@version=6
indicator("test")
x = request.security(syminfo.tickerid, "D", close)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('repaint intrabar'))
      expect(warns).toHaveLength(1)
    })

    it('is silent when the expression is offset', () => {
      const code = `//@version=6
indicator("test")
x = request.security(syminfo.tickerid, "D", close[1])
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('repaint intrabar'))
      expect(warns).toHaveLength(0)
    })
  })

  describe('drawing object leaks', () => {
    it('warns on label.new() with no delete and no max_labels_count', () => {
      const code = `//@version=6
indicator("test")
if close > open
    label.new(bar_index, high, "test")
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('label.new()'))
      expect(warns).toHaveLength(1)
    })

    it('is silent when a matching delete call exists', () => {
      const code = `//@version=6
indicator("test")
if close > open
    label.new(bar_index, high, "test")
label.delete(na)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('label.new()'))
      expect(warns).toHaveLength(0)
    })

    it('is silent when max_labels_count is set on the declaration', () => {
      const code = `//@version=6
indicator("test", max_labels_count = 500)
if close > open
    label.new(bar_index, high, "test")
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('label.new()'))
      expect(warns).toHaveLength(0)
    })

    it('is silent when the object is held in var', () => {
      const code = `//@version=6
indicator("test")
if close > open
    var lbl = label.new(bar_index, high, "test")
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('label.new()'))
      expect(warns).toHaveLength(0)
    })

    it('is silent when guarded by barstate.islast', () => {
      const code = `//@version=6
indicator("test")
if barstate.islast
    label.new(bar_index, high, "test")
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('label.new()'))
      expect(warns).toHaveLength(0)
    })
  })

  describe('na in ternary', () => {
    it('warns when a possibly-na ternary result is used as a bare condition', () => {
      const code = `//@version=6
indicator("test")
x = close > open ? close : na
if x
    label.new(bar_index, high)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes("may be 'na'"))
      expect(warns).toHaveLength(1)
    })

    it('is silent when guarded with not na(x)', () => {
      const code = `//@version=6
indicator("test")
x = close > open ? close : na
if not na(x) and x
    label.new(bar_index, high)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes("may be 'na'"))
      expect(warns).toHaveLength(0)
    })

    it('is silent when neither ternary branch is na', () => {
      const code = `//@version=6
indicator("test")
x = close > open ? close : open
if x
    label.new(bar_index, high)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes("may be 'na'"))
      expect(warns).toHaveLength(0)
    })
  })

  describe('performance loops', () => {
    it('warns on a loop bounded by bar_index', () => {
      const code = `//@version=6
indicator("test")
for i = 0 to bar_index
    x = close[i]
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'info' && d.message.includes("'bar_index'"))
      expect(warns).toHaveLength(1)
    })

    it('warns on a loop with a large literal bound', () => {
      const code = `//@version=6
indicator("test")
for i = 0 to 1000
    x = close[i]
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'info' && d.message.includes('large bound'))
      expect(warns).toHaveLength(1)
    })

    it('is silent on a small bounded loop', () => {
      const code = `//@version=6
indicator("test")
for i = 0 to 10
    x = close[i]
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'info')
      expect(warns).toHaveLength(0)
    })

    it('is silent when guarded by barstate.islast', () => {
      const code = `//@version=6
indicator("test")
if barstate.islast
    for i = 0 to 1000
        x = close[i]
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.severity === 'info')
      expect(warns).toHaveLength(0)
    })
  })

  describe('qualifier mismatch', () => {
    function docsMapWithNonSeriesArg(): Map<string, any> {
      return new Map([
        ['myFunc', { name: 'myFunc', args: [{ name: 'len', allowedTypeIDs: ['simple int', 'input int', 'const int'] }] }],
      ])
    }

    it('is a no-op when no docsMap is provided', () => {
      const code = `//@version=6
indicator("test")
x = myFunc(ta.sma(close, 5))
`
      const diags = new PineStaticAnalyzer(code).analyze()
      expect(diags.filter(d => d.message.includes('requires'))).toHaveLength(0)
    })

    it('warns when a series expression is passed to a non-series parameter', () => {
      const code = `//@version=6
indicator("test")
x = myFunc(ta.sma(close, 5))
`
      const diags = new PineStaticAnalyzer(code, docsMapWithNonSeriesArg()).analyze()
      const warns = diags.filter(d => d.message.includes('requires'))
      expect(warns).toHaveLength(1)
      expect(warns[0].message).toContain("parameter 'len'")
      expect(warns[0].message).toContain('simple int')
    })

    it('is silent for a literal argument', () => {
      const code = `//@version=6
indicator("test")
x = myFunc(14)
`
      const diags = new PineStaticAnalyzer(code, docsMapWithNonSeriesArg()).analyze()
      expect(diags.filter(d => d.message.includes('requires'))).toHaveLength(0)
    })

    it('is silent when the call uses named arguments', () => {
      const code = `//@version=6
indicator("test")
x = myFunc(len = ta.sma(close, 5))
`
      const diags = new PineStaticAnalyzer(code, docsMapWithNonSeriesArg()).analyze()
      expect(diags.filter(d => d.message.includes('requires'))).toHaveLength(0)
    })

    it('is silent when series is among the allowed qualifiers', () => {
      const docsMap = new Map([
        ['myFunc', { name: 'myFunc', args: [{ name: 'len', allowedTypeIDs: ['series int', 'simple int'] }] }],
      ])
      const code = `//@version=6
indicator("test")
x = myFunc(ta.sma(close, 5))
`
      const diags = new PineStaticAnalyzer(code, docsMap).analyze()
      expect(diags.filter(d => d.message.includes('requires'))).toHaveLength(0)
    })
  })

  describe('complexity profiler', () => {
    it('warns on nested request.security() calls', () => {
      const code = `//@version=6
indicator("test")
x = request.security(syminfo.tickerid, "D", request.security(syminfo.tickerid, "W", close))
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('Nested request.security()'))
      expect(warns).toHaveLength(1)
      expect(warns[0].severity).toBe('info')
    })

    it('is silent for a single non-nested request.security() call', () => {
      const code = `//@version=6
indicator("test")
x = request.security(syminfo.tickerid, "D", close)
`
      const diags = analyze(code)
      expect(diags.filter(d => d.message.includes('Nested request.security()'))).toHaveLength(0)
    })

    it('warns on a matrix operation inside a loop', () => {
      const code = `//@version=6
indicator("test")
m = matrix.new<float>(3, 3, 0.0)
for i = 0 to 2
    x = matrix.get(m, i, 0)
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('Matrix operation'))
      expect(warns).toHaveLength(1)
      expect(warns[0].severity).toBe('info')
    })

    it('is silent for a matrix operation outside a loop', () => {
      const code = `//@version=6
indicator("test")
m = matrix.new<float>(3, 3, 0.0)
x = matrix.get(m, 0, 0)
`
      const diags = analyze(code)
      expect(diags.filter(d => d.message.includes('Matrix operation'))).toHaveLength(0)
    })

    it('warns on a nested loop', () => {
      const code = `//@version=6
indicator("test")
for i = 0 to 10
    for j = 0 to 5
        x = i + j
`
      const diags = analyze(code)
      const warns = diags.filter(d => d.message.includes('Nested loop'))
      expect(warns).toHaveLength(1)
      expect(warns[0].message).toContain('depth 2')
    })

    it('is silent for a single non-nested loop', () => {
      const code = `//@version=6
indicator("test")
for i = 0 to 10
    x = i * 2
`
      const diags = analyze(code)
      expect(diags.filter(d => d.message.includes('Nested loop'))).toHaveLength(0)
    })
  })
})
