import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('pineDocs.json v6 completeness', () => {
  let docs: any
  beforeAll(() => {
    docs = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'Pine_Script_Documentation', 'pineDocs.json'), 'utf-8'
    ))
  })

  function findDoc(name: string, category: string): any {
    return (docs[category]?.[0]?.docs ?? []).find((d: any) => d.name === name)
  }
  function findInAny(name: string): any {
    for (const key of Object.keys(docs)) {
      const found = findDoc(name, key)
      if (found) return found
    }
    return null
  }

  it('has enum keyword in controls', () => { expect(findDoc('enum', 'controls')).toBeTruthy() })
  it('has log.info', () => { expect(findInAny('log.info')).toBeTruthy() })
  it('has log.warning', () => { expect(findInAny('log.warning')).toBeTruthy() })
  it('has log.error', () => { expect(findInAny('log.error')).toBeTruthy() })
  it('has request.footprint', () => { expect(findInAny('request.footprint')).toBeTruthy() })
  it('has bid', () => { expect(findInAny('bid')).toBeTruthy() })
  it('has ask', () => { expect(findInAny('ask')).toBeTruthy() })
  it('has strategy.closedtrades.first_index', () => { expect(findInAny('strategy.closedtrades.first_index')).toBeTruthy() })
  it('has text.format_bold', () => { expect(findInAny('text.format_bold')).toBeTruthy() })
  it('has text.format_italic', () => { expect(findInAny('text.format_italic')).toBeTruthy() })
  it('has plot.linestyle_solid', () => { expect(findInAny('plot.linestyle_solid')).toBeTruthy() })
  it('has plot.linestyle_dashed', () => { expect(findInAny('plot.linestyle_dashed')).toBeTruthy() })
  it('has plot.linestyle_dotted', () => { expect(findInAny('plot.linestyle_dotted')).toBeTruthy() })
  it('has footprint type', () => { expect(findDoc('footprint', 'types')).toBeTruthy() })
  it('has volume_row type', () => { expect(findDoc('volume_row', 'types')).toBeTruthy() })
  it('has @enum annotation', () => {
    expect(findDoc('@enum', 'annotations') || findDoc('enum', 'annotations')).toBeTruthy()
  })
})
