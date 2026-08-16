import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('TextMate Grammar v6 coverage', () => {
  let grammarText: string
  let grammar: any
  beforeAll(() => {
    grammarText = fs.readFileSync(
      path.join(__dirname, '..', 'syntaxes', 'pine.tmLanguage.json'), 'utf-8'
    )
    grammar = JSON.parse(grammarText)
  })

  it('includes enum keyword', () => { expect(grammarText).toContain('enum') })
  it('includes log namespace', () => { expect(grammarText).toContain('log') })
  it('includes footprint type', () => { expect(grammarText).toContain('footprint') })
  it('includes volume_row type', () => { expect(grammarText).toContain('volume_row') })
  it('includes bid variable', () => { expect(grammarText).toContain('bid') })
  it('includes ask variable', () => { expect(grammarText).toContain('ask') })
  it('includes triple-double-quote multiline string delimiter', () => {
    const patterns = grammar.repository.strings.patterns[0].patterns
    expect(patterns.some((p: any) => p.begin === '"""' && p.end === '"""')).toBe(true)
  })
  it('includes triple-single-quote multiline string delimiter', () => {
    const patterns = grammar.repository.strings.patterns[0].patterns
    expect(patterns.some((p: any) => p.begin === "'''" && p.end === "'''")).toBe(true)
  })
  it('places triple-quote string patterns before single-quote patterns', () => {
    const patterns = grammar.repository.strings.patterns[0].patterns
    const tripleIdx = patterns.findIndex((p: any) => p.begin === '"""')
    const singleIdx = patterns.findIndex((p: any) => p.name === 'string.quoted.double')
    expect(tripleIdx).toBeGreaterThanOrEqual(0)
    expect(tripleIdx).toBeLessThan(singleIdx)
  })
})
