/**
 * PineConformanceReporter - Produces structured Markdown and JSON conformance reports
 */

import { ConformanceGap, ConformanceScorecard } from './PineReferenceManifest'

export class PineConformanceReporter {
  static generateMarkdownReport(scorecard: ConformanceScorecard, gaps: ConformanceGap[]): string {
    const lines: string[] = []

    lines.push('# Pine Script v6 Conformance & Drift Report\n')
    lines.push('## Pine Script v6 Compatibility Score\n')
    lines.push('| Layer | Total | Matched | Score |')
    lines.push('| :--- | :--- | :--- | :--- |')
    lines.push(`| **Symbols** | ${scorecard.symbols.total} | ${scorecard.symbols.matched} | ${scorecard.symbols.percentage}% |`)
    lines.push(`| **Signatures** | ${scorecard.signatures.total} | ${scorecard.signatures.matched} | ${scorecard.signatures.percentage}% |`)
    lines.push(`| **Types** | ${scorecard.types.total} | ${scorecard.types.matched} | ${scorecard.types.percentage}% |`)
    lines.push(`| **Grammar** | ${scorecard.grammar.total} | ${scorecard.grammar.matched} | ${scorecard.grammar.percentage}% |`)
    lines.push(`| **Parser** | ${scorecard.parser.total} | ${scorecard.parser.matched} | ${scorecard.parser.percentage}% |`)
    lines.push(`| **Completions** | ${scorecard.completions.total} | ${scorecard.completions.matched} | ${scorecard.completions.percentage}% |`)
    lines.push(`| **Hover Documentation** | ${scorecard.hover.total} | ${scorecard.hover.matched} | ${scorecard.hover.percentage}% |`)
    lines.push(`| **Static Analysis** | ${scorecard.staticAnalysis.total} | ${scorecard.staticAnalysis.matched} | ${scorecard.staticAnalysis.percentage}% |`)
    lines.push(`| **Overall Compatibility** | - | - | **${scorecard.overallPercentage}%** |\n`)

    const criticalGaps = gaps.filter(g => g.severity === 'P0' || g.severity === 'P1')
    lines.push(`## Critical Gaps (${criticalGaps.length})\n`)

    if (criticalGaps.length === 0) {
      lines.push('✓ No critical P0/P1 conformance gaps detected!\n')
    } else {
      for (const gap of criticalGaps) {
        lines.push(`- **[${gap.severity}]** \`${gap.symbolName}\`: ${gap.description}`)
      }
      lines.push('')
    }

    lines.push('## Full Conformance Gaps List\n')
    lines.push('| Severity | Category | Layer | Symbol | Description |')
    lines.push('| :--- | :--- | :--- | :--- | :--- |')
    for (const gap of gaps) {
      lines.push(`| \`${gap.severity}\` | \`${gap.category}\` | \`${gap.layer}\` | \`${gap.symbolName}\` | ${gap.description} |`)
    }

    return lines.join('\n')
  }

  static generateJsonReport(scorecard: ConformanceScorecard, gaps: ConformanceGap[]): string {
    return JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scorecard,
        totalGaps: gaps.length,
        criticalGapsCount: scorecard.criticalGapsCount,
        gaps,
      },
      null,
      2,
    )
  }
}
