import { describe, it, expect } from 'vitest'
import { looksLikeSeriesExpression } from '../src/PineQualifierInference'

describe('looksLikeSeriesExpression', () => {
  it('returns false for numeric literals', () => {
    expect(looksLikeSeriesExpression('14')).toBe(false)
    expect(looksLikeSeriesExpression('-3.5')).toBe(false)
  })

  it('returns false for string/bool/color literals', () => {
    expect(looksLikeSeriesExpression('"D"')).toBe(false)
    expect(looksLikeSeriesExpression("'D'")).toBe(false)
    expect(looksLikeSeriesExpression('true')).toBe(false)
    expect(looksLikeSeriesExpression('#ff0000')).toBe(false)
  })

  it('returns false for input.*() calls', () => {
    expect(looksLikeSeriesExpression('input.int(14, "Length")')).toBe(false)
  })

  it('returns true for bare OHLCV identifiers', () => {
    expect(looksLikeSeriesExpression('close')).toBe(true)
    expect(looksLikeSeriesExpression('bar_index')).toBe(true)
    expect(looksLikeSeriesExpression('hl2')).toBe(true)
  })

  it('returns true for ta.*/request.* calls', () => {
    expect(looksLikeSeriesExpression('ta.sma(close, 14)')).toBe(true)
    expect(looksLikeSeriesExpression('request.security(syminfo.tickerid, "D", close)')).toBe(true)
  })

  it('returns true for history-offset expressions', () => {
    expect(looksLikeSeriesExpression('myVar[1]')).toBe(true)
  })

  it('returns false for an unrecognized bare identifier', () => {
    expect(looksLikeSeriesExpression('lengthInput')).toBe(false)
  })
})
