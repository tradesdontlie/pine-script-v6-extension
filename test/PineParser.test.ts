import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../src/index', () => ({
  Class: {
    PineDocsManager: { setParsed: vi.fn() },
    PineRequest: { libList: vi.fn(), getScript: vi.fn() },
  },
}))
vi.mock('../src/PineHelpers', () => ({
  Helpers: { checkDocsMatch: vi.fn() },
}))
vi.mock('../src/VSCode', () => ({
  VSCode: { Text: '' },
}))

import { PineParser } from '../src/PineParser'

describe('PineParser enum parsing', () => {
  let parser: PineParser
  beforeEach(() => { parser = new PineParser() })

  it('parses basic enum', () => {
    const result = parser.parseEnums([{ script: 'enum Direction\n    long\n    short\n    flat\n' }])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Direction')
    expect(result[0].fields).toHaveLength(3)
    expect(result[0].fields[0].name).toBe('long')
  })

  it('parses enum with string titles', () => {
    const result = parser.parseEnums([{ script: 'enum Signal\n    buy = "Buy Signal"\n    sell = "Sell Signal"\n' }])
    expect(result[0].fields[0].title).toBe('Buy Signal')
  })

  it('parses exported enum', () => {
    const result = parser.parseEnums([{ script: 'export enum Color\n    red\n    green\n' }])
    expect(result[0].exported).toBe(true)
  })

  it('parses multiple enums', () => {
    const result = parser.parseEnums([{ script: 'enum A\n    x\n\nenum B\n    y\n    z\n' }])
    expect(result).toHaveLength(2)
  })

  it('handles alias prefix for libraries', () => {
    const result = parser.parseEnums([{ script: 'export enum Dir\n    up\n', alias: 'mylib' }])
    expect(result[0].name).toBe('mylib.Dir')
  })

  it('returns empty for non-string scripts', () => {
    const result = parser.parseEnums([{ script: 123 }])
    expect(result).toHaveLength(0)
  })

  it('returns empty for empty documents', () => {
    const result = parser.parseEnums([])
    expect(result).toHaveLength(0)
  })
})
