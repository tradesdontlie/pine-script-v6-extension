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

  it('uses //@version=6 in all examples and no //@version=5', () => {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'Pine_Script_Documentation', 'pineDocs.json'), 'utf-8'
    )
    expect((raw.match(/\/\/@version=5/g) || []).length).toBe(0)
    expect((raw.match(/\/\/@version=6/g) || []).length).toBeGreaterThan(500)
  })

  it('has text.format_none constant', () => {
    expect(findInAny('text.format_none')).toBeTruthy()
  })

  it('has text_formatting parameter in label.new, box.new, and table.cell', () => {
    const labelNew = findDoc('label.new', 'functions')
    expect(labelNew.args.some((a: any) => a.name === 'text_formatting')).toBe(true)

    const boxNew = findDoc('box.new', 'functions')
    expect(boxNew.args.some((a: any) => a.name === 'text_formatting')).toBe(true)

    const tableCell = findDoc('table.cell', 'functions')
    expect(tableCell.args.some((a: any) => a.name === 'text_formatting')).toBe(true)
  })

  it('has set_text_formatting functions and methods for label, box, and table.cell', () => {
    expect(findDoc('label.set_text_formatting', 'functions')).toBeTruthy()
    expect(findDoc('label.set_text_formatting', 'methods')).toBeTruthy()
    expect(findDoc('box.set_text_formatting', 'functions')).toBeTruthy()
    expect(findDoc('box.set_text_formatting', 'methods')).toBeTruthy()
    expect(findDoc('table.cell_set_text_formatting', 'functions')).toBeTruthy()
    expect(findDoc('table.cell_set_text_formatting', 'methods')).toBeTruthy()
  })

  it('supports numeric point sizes in size/text_size parameters', () => {
    const labelNew = findDoc('label.new', 'functions')
    const sizeArg = labelNew.args.find((a: any) => a.name === 'size')
    expect(sizeArg.allowedTypeIDs).toContain('series int')

    const boxNew = findDoc('box.new', 'functions')
    const textSizeArg = boxNew.args.find((a: any) => a.name === 'text_size')
    expect(textSizeArg.allowedTypeIDs).toContain('series int')
  })

  it('documents negative array indices in array.get and array.set', () => {
    const arrayGet = findDoc('array.get', 'functions')
    expect(arrayGet.desc).toContain('negative')
    const indexArg = arrayGet.args.find((a: any) => a.name === 'index')
    expect(indexArg.desc).toContain('negative')
  })

  it('documents dynamic symbol requests in request.security', () => {
    const reqSec = findDoc('request.security', 'functions')
    const symbolArg = reqSec.args.find((a: any) => a.name === 'symbol')
    expect(symbolArg.displayType).toBe('series string')
    expect(reqSec.remarks).toContain('dynamic requests')
  })

  it('documents short-circuit evaluation in and/or operators', () => {
    const opAnd = findDoc('and', 'controls')
    expect(opAnd.desc).toContain('short-circuit')
    const opOr = findDoc('or', 'controls')
    expect(opOr.desc).toContain('short-circuit')
  })

  it('documents automatic order trimming in strategy.order and closedtrades.first_index', () => {
    const stratOrder = findDoc('strategy.order', 'functions')
    expect(stratOrder.remarks).toContain('9,000')
    const firstIdx = findDoc('strategy.closedtrades.first_index', 'variables')
    expect(firstIdx.desc).toContain('trimmed')
  })
})
