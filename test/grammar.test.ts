import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('TextMate Grammar v6 coverage', () => {
  let grammarText: string
  beforeAll(() => {
    grammarText = fs.readFileSync(
      path.join(__dirname, '..', 'syntaxes', 'pine.tmLanguage.json'), 'utf-8'
    )
  })

  it('includes enum keyword', () => { expect(grammarText).toContain('enum') })
  it('includes log namespace', () => { expect(grammarText).toContain('log') })
  it('includes footprint type', () => { expect(grammarText).toContain('footprint') })
  it('includes volume_row type', () => { expect(grammarText).toContain('volume_row') })
  it('includes bid variable', () => { expect(grammarText).toContain('bid') })
  it('includes ask variable', () => { expect(grammarText).toContain('ask') })
})
