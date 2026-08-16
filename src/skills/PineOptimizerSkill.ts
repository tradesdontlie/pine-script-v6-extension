/**
 * PineOptimizerSkill - Analyzes Pine Script code for optimization candidates
 * 
 * Heuristics:
 * - PINE-CACHE-001: Cache repeated ta.* and math.* calculations
 * - PINE-HTF-001: Consolidate multiple request.security calls into tuples
 * - PINE-LOOP-001: Cache dynamic loop boundaries
 * - PINE-ARCH-001: Refactor parallel state arrays into UDTs
 */

import { PineSkill, PineSkillContext, PineSkillDefinition, PineSkillResult } from './PineSkill'

export interface OptimizationCandidate {
  ruleId: string
  title: string
  description: string
  suggestion: string
  estimatedImpact: 'high' | 'medium' | 'low'
  line?: number
}

export class PineOptimizerSkill extends PineSkill {
  readonly definition: PineSkillDefinition = {
    id: 'pine-optimizer',
    name: 'Pine Script Optimizer',
    description: 'Identifies performance bottlenecks, redundant calculations, and architectural refactoring opportunities.',
    version: '1.0.0',
    triggerPatterns: ['optimize', 'caching', 'performance', 'slow', 'refactor'],
    requiredTools: ['pine_validate'],
    optionalTools: ['pine_search_docs', 'pine_patch'],
  }

  async execute(context: PineSkillContext): Promise<PineSkillResult> {
    const code = context.fileContent ?? ''
    const candidates = this.analyzeOptimizations(code)
    const content = this.formatReport(candidates)

    return {
      success: true,
      content,
    }
  }

  private analyzeOptimizations(code: string): OptimizationCandidate[] {
    const candidates: OptimizationCandidate[] = []
    const lines = code.split('\n')

    this.checkRepeatedCalls(lines, candidates)
    this.checkHTFCalls(lines, candidates)
    this.checkLoopBounds(lines, candidates)
    this.checkParallelArrays(lines, candidates)

    return candidates
  }

  private checkRepeatedCalls(lines: string[], candidates: OptimizationCandidate[]): void {
    const callCounts = new Map<string, number>()
    const patterns = [/\b(ta\.sma\([^)]+\))/g, /\b(ta\.ema\([^)]+\))/g, /\b(ta\.rsi\([^)]+\))/g, /\b(ta\.atr\([^)]+\))/g]

    for (const line of lines) {
      for (const pattern of patterns) {
        let match: RegExpExecArray | null
        while ((match = pattern.exec(line)) !== null) {
          callCounts.set(match[1], (callCounts.get(match[1]) ?? 0) + 1)
        }
      }
    }

    for (const [call, count] of callCounts.entries()) {
      if (count > 1) {
        candidates.push({
          ruleId: 'PINE-CACHE-001',
          title: `Redundant Calculation: ${call}`,
          description: `Expression '${call}' is computed ${count} times on each bar execution.`,
          suggestion: `Store result in a variable: 'varOrSeries = ${call}' and reuse.`,
          estimatedImpact: count > 3 ? 'high' : 'medium',
        })
      }
    }
  }

  private checkHTFCalls(lines: string[], candidates: OptimizationCandidate[]): void {
    let securityCount = 0
    for (const line of lines) {
      if (line.includes('request.security(')) {
        securityCount++
      }
    }

    if (securityCount > 1) {
      candidates.push({
        ruleId: 'PINE-HTF-001',
        title: 'Multiple request.security() calls detected',
        description: `Found ${securityCount} separate request.security() calls. Each call creates an independent data subscription.`,
        suggestion: 'Consolidate multiple series into a tuple: [h, l, c] = request.security(syminfo.tickerid, "D", [high, low, close])',
        estimatedImpact: 'high',
      })
    }
  }

  private checkLoopBounds(lines: string[], candidates: OptimizationCandidate[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/\bfor\s+\w+\s*=\s*\d+\s+to\s+array\.size\(/i.test(line)) {
        candidates.push({
          ruleId: 'PINE-LOOP-001',
          title: 'Dynamic Array Size in Loop Condition',
          description: 'array.size() evaluated inside loop definition.',
          suggestion: 'Cache array size in a local variable before loop: int len = array.size(arr) - 1',
          estimatedImpact: 'medium',
          line: i + 1,
        })
      }
    }
  }

  private checkParallelArrays(lines: string[], candidates: OptimizationCandidate[]): void {
    let arrayCount = 0
    for (const line of lines) {
      if (/\barray\.new<|\barray\.new_\w+\(/.test(line)) {
        arrayCount++
      }
    }

    if (arrayCount >= 4) {
      candidates.push({
        ruleId: 'PINE-ARCH-001',
        title: 'High Number of Parallel Arrays',
        description: `Detected ${arrayCount} distinct arrays. Parallel arrays increase memory allocation and indexing synchronization risks.`,
        suggestion: 'Group related fields into a User-Defined Type (UDT) and manage a single array<UDT>.',
        estimatedImpact: 'medium',
      })
    }
  }

  private formatReport(candidates: OptimizationCandidate[]): string {
    if (candidates.length === 0) {
      return '## PineForge Optimization Report\n\n✓ No performance bottlenecks or redundant calculations detected!'
    }

    const lines: string[] = ['## PineForge Optimization Report\n']
    lines.push(`Found **${candidates.length}** optimization candidate(s):\n`)

    for (const c of candidates) {
      lines.push(`### [${c.ruleId}] ${c.title}`)
      lines.push(`- **Impact**: \`${c.estimatedImpact.toUpperCase()}\``)
      if (c.line) {lines.push(`- **Location**: Line ${c.line}`)}
      lines.push(`- **Issue**: ${c.description}`)
      lines.push(`- **Recommendation**: ${c.suggestion}\n`)
    }

    return lines.join('\n')
  }
}
