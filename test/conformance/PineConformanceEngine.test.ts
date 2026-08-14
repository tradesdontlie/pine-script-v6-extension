import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { PineReferenceNormalizer } from '../../src/conformance/PineReferenceNormalizer'
import { PineGapDetector } from '../../src/conformance/PineGapDetector'
import { PineFixtureGenerator } from '../../src/conformance/PineFixtureGenerator'
import { PineConformanceReporter } from '../../src/conformance/PineConformanceReporter'
import { PineReferenceManifest } from '../../src/conformance/PineReferenceManifest'
import { syncPineReference } from '../../scripts/sync-pine-reference'
import { generateConformanceFixtures } from '../../scripts/generate-conformance-fixtures'
import { runConformanceReport } from '../../scripts/report-pine-gaps'

describe('Pine v6 Conformance Diff Engine', () => {
  const rootDir = path.join(__dirname, '..', '..')

  beforeAll(() => {
    syncPineReference(rootDir)
    generateConformanceFixtures(rootDir)
  })

  it('normalizes pineDocs.json into a Canonical Manifest', () => {
    const docsPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineDocs.json')
    const rawDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'))
    const manifest = PineReferenceNormalizer.normalizeRawDocs(rawDocs, '6.0.0-test')

    expect(manifest.pineVersion).toBe(6)
    expect(Object.keys(manifest.symbols).length).toBeGreaterThan(600)
    expect(manifest.symbols['array.sort']).toBeDefined()
    expect(manifest.symbols['strategy']).toBeDefined()
  })

  it('detects sort_field parameter in array.sort and matrix.sort', () => {
    const docsPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineDocs.json')
    const rawDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'))
    const manifest = PineReferenceNormalizer.normalizeRawDocs(rawDocs, '6.0.0-test')

    const sortFn = manifest.symbols['array.sort']
    expect(sortFn.signature?.parameters.some(p => p.name === 'sort_field')).toBe(true)

    const matrixSort = manifest.symbols['matrix.sort']
    expect(matrixSort.signature?.parameters.some(p => p.name === 'sort_field')).toBe(true)
  })

  it('detects sort_field parameter in array.binary_search functions', () => {
    const docsPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineDocs.json')
    const rawDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'))
    const manifest = PineReferenceNormalizer.normalizeRawDocs(rawDocs, '6.0.0-test')

    for (const name of ['array.binary_search', 'array.binary_search_leftmost', 'array.binary_search_rightmost']) {
      const fn = manifest.symbols[name]
      expect(fn.signature?.parameters.some(p => p.name === 'sort_field')).toBe(true)
    }
  })

  it('detects calc_on_every_history_tick in strategy()', () => {
    const docsPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineDocs.json')
    const rawDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'))
    const manifest = PineReferenceNormalizer.normalizeRawDocs(rawDocs, '6.0.0-test')

    const strat = manifest.symbols['strategy']
    expect(strat.signature?.parameters.some(p => p.name === 'calc_on_every_history_tick')).toBe(true)
  })

  it('generates valid conformance fixtures', () => {
    const fixtures = PineFixtureGenerator.getStandardConformanceFixtures()
    expect(fixtures.length).toBeGreaterThanOrEqual(6)

    const multiline = fixtures.find(f => f.name === 'multiline_strings_double_quotes')
    expect(multiline).toBeDefined()
    expect(multiline?.code).toContain('"""')

    const udtSort = fixtures.find(f => f.name === 'udt_array_sort_field')
    expect(udtSort?.code).toContain('sort_field = "price"')
  })

  it('computes conformance scorecard and reports high compatibility', () => {
    const { scorecard, markdown, gaps } = runConformanceReport(rootDir)
    expect(scorecard.overallPercentage).toBeGreaterThan(95.0)
    expect(scorecard.symbols.percentage).toBeGreaterThan(98.0)
    expect(markdown).toContain('Pine Script v6 Conformance & Drift Report')
    expect(fs.existsSync(path.join(rootDir, 'reports', 'pine-v6-gap-report.md'))).toBe(true)
    expect(fs.existsSync(path.join(rootDir, 'reports', 'pine-v6-gap-report.json'))).toBe(true)
  })
})
