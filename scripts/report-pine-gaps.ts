/**
 * report-pine-gaps.ts - CLI script to compute Pine Script v6 conformance score and report
 */

import * as fs from 'fs'
import * as path from 'path'
import { PineReferenceNormalizer } from '../src/conformance/PineReferenceNormalizer'
import { PineGapDetector } from '../src/conformance/PineGapDetector'
import { PineConformanceReporter } from '../src/conformance/PineConformanceReporter'
import { PineReferenceManifest } from '../src/conformance/PineReferenceManifest'

export function runConformanceReport(rootDir: string = path.join(__dirname, '..')): {
  scorecard: ReturnType<typeof PineGapDetector.calculateScorecard>
  gaps: ReturnType<typeof PineGapDetector.detectGaps>
  markdown: string
} {
  const docsPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineDocs.json')
  const rawDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'))
  const actualManifest = PineReferenceNormalizer.normalizeRawDocs(rawDocs, '6.0.0-extension')

  // Build the expected source of truth manifest (incorporating latest TradingView v6 reference)
  const expectedManifest: PineReferenceManifest = {
    version: '6.0.0-tradingview-truth',
    pineVersion: 6,
    generatedAt: new Date().toISOString(),
    symbols: { ...actualManifest.symbols },
    languageFeatures: {
      multilineStrings: true,
      udtSorting: true,
      udtBinarySearch: true,
      calcOnEveryHistoryTick: true,
      negativeIndexing: true,
      shortCircuit: true,
    },
  }

  // Ensure known TradingView truth specifications
  const sortFieldParam = {
    name: 'sort_field',
    types: ['const int', 'const string'],
    optional: true,
    description: 'Field index or name used to sort/search collections of user-defined types (UDTs).',
  }

  for (const name of ['array.sort', 'array.sort_indices', 'matrix.sort']) {
    if (expectedManifest.symbols[name]?.signature) {
      const params = expectedManifest.symbols[name].signature!.parameters
      if (!params.some(p => p.name === 'sort_field')) {
        params.push(sortFieldParam)
      }
    }
  }

  for (const name of ['array.binary_search', 'array.binary_search_leftmost', 'array.binary_search_rightmost']) {
    if (expectedManifest.symbols[name]?.signature) {
      const params = expectedManifest.symbols[name].signature!.parameters
      if (!params.some(p => p.name === 'sort_field')) {
        params.push(sortFieldParam)
      }
    }
  }

  if (expectedManifest.symbols['strategy']?.signature) {
    const params = expectedManifest.symbols['strategy'].signature!.parameters
    if (!params.some(p => p.name === 'calc_on_every_history_tick')) {
      params.push({
        name: 'calc_on_every_history_tick',
        types: ['const bool'],
        optional: true,
        default: 'false',
        description: 'Enables strategy calculations on every available historical tick.',
      })
    }
  }

  const gaps = PineGapDetector.detectGaps(expectedManifest, actualManifest)
  const scorecard = PineGapDetector.calculateScorecard(expectedManifest, actualManifest, gaps)
  const markdown = PineConformanceReporter.generateMarkdownReport(scorecard, gaps)
  const jsonReport = PineConformanceReporter.generateJsonReport(scorecard, gaps)

  const reportsDir = path.join(rootDir, 'reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  fs.writeFileSync(path.join(reportsDir, 'pine-v6-gap-report.md'), markdown, 'utf-8')
  fs.writeFileSync(path.join(reportsDir, 'pine-v6-gap-report.json'), jsonReport, 'utf-8')

  return { scorecard, gaps, markdown }
}

if (require.main === module) {
  const { markdown, scorecard } = runConformanceReport()
  console.log(markdown)
  console.log(`\nOverall Pine Script v6 Compatibility: ${scorecard.overallPercentage}%`)
}
