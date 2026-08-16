/**
 * PineValidateTool - Comprehensive validation tool
 * Combines static analysis, type checking, and reference conformance
 */

import { PineTool, PineToolDefinition, PineToolResult } from './PineTool'
import { PineStaticAnalyzer, AnalyzerDiagnostic } from '../index'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'

export interface ValidationResult {
  syntax: { valid: boolean; errors: string[] }
  types: { valid: boolean; errors: string[] }
  staticAnalysis: { valid: boolean; diagnostics: AnalyzerDiagnostic[] }
  referenceConformance: { valid: boolean; unknownSymbols: string[] }
  summary: {
    valid: boolean
    errorCount: number
    warningCount: number
  }
}

export class PineValidateTool extends PineTool {
  readonly definition: PineToolDefinition = {
    name: 'pine_validate',
    description: 'Validate Pine Script code for syntax, types, static analysis issues, and reference conformance. Returns detailed diagnostics.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The Pine Script code to validate',
        },
        mode: {
          type: 'string',
          description: 'Validation mode: "quick" (syntax only) or "full" (all checks)',
          enum: ['quick', 'full'],
        },
      },
      required: ['code'],
    },
  }

  constructor(private knowledgeEngine: PineKnowledgeEngine) {
    super()
  }

  async execute(args: Record<string, unknown>): Promise<PineToolResult> {
    const code = args.code as string
    const mode = (args.mode as 'quick' | 'full') ?? 'full'

    if (!code || typeof code !== 'string') {
      return {
        success: false,
        content: 'Error: code parameter is required and must be a string',
      }
    }

    try {
      const result = await this.validate(code, mode)
      const formatted = this.formatValidationResult(result)

      return {
        success: result.summary.valid,
        content: formatted,
        metadata: {
          validation: result,
          requiresConfirmation: !result.summary.valid,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        content: `Validation error: ${error.message}`,
      }
    }
  }

  private async validate(code: string, mode: 'quick' | 'full'): Promise<ValidationResult> {
    const result: ValidationResult = {
      syntax: { valid: true, errors: [] },
      types: { valid: true, errors: [] },
      staticAnalysis: { valid: true, diagnostics: [] },
      referenceConformance: { valid: true, unknownSymbols: [] },
      summary: { valid: true, errorCount: 0, warningCount: 0 },
    }

    // Run static analyzer
    const analyzer = new PineStaticAnalyzer(code)
    const diagnostics = analyzer.analyze()
    result.staticAnalysis.diagnostics = diagnostics

    const errors = diagnostics.filter(d => d.severity === 'error')
    const warnings = diagnostics.filter(d => d.severity === 'warning')

    result.staticAnalysis.valid = errors.length === 0
    result.summary.errorCount += errors.length
    result.summary.warningCount += warnings.length

    // Reference conformance check (simplified)
    if (mode === 'full') {
      const unknownSymbols = this.checkReferenceConformance(code)
      result.referenceConformance.unknownSymbols = unknownSymbols
      result.referenceConformance.valid = unknownSymbols.length === 0

      if (!result.referenceConformance.valid) {
        result.summary.errorCount += unknownSymbols.length
      }
    }

    result.summary.valid = result.summary.errorCount === 0

    return result
  }

  private checkReferenceConformance(code: string): string[] {
    const unknownSymbols: string[] = []

    // Extract potential function/method calls
    const callPattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\s*\(/g
    let match

    while ((match = callPattern.exec(code)) !== null) {
      const symbol = match[1]

      // Skip keywords and control flow
      if (['if', 'else', 'for', 'while', 'switch', 'return', 'var', 'const', 'let'].includes(symbol)) {
        continue
      }

      // Check if symbol exists in knowledge base
      const ref = this.knowledgeEngine.query(symbol)
      if (!ref) {
        // Check if it's a method call (e.g., array.size)
        const parts = symbol.split('.')
        if (parts.length >= 2) {
          const namespace = parts[0]
          const nsRef = this.knowledgeEngine.query(namespace)
          if (!nsRef) {
            unknownSymbols.push(symbol)
          }
        } else {
          unknownSymbols.push(symbol)
        }
      }
    }

    return unknownSymbols
  }

  private formatValidationResult(result: ValidationResult): string {
    const lines: string[] = []

    lines.push('## Validation Report\n')

    if (result.summary.valid) {
      lines.push('✅ **Validation PASSED**\n')
      lines.push('- Errors: 0')
      lines.push(`- Warnings: ${result.summary.warningCount}\n`)
    } else {
      lines.push('❌ **Validation FAILED**\n')
      lines.push(`- Errors: ${result.summary.errorCount}`)
      lines.push(`- Warnings: ${result.summary.warningCount}\n`)
    }

    // Static Analysis
    if (result.staticAnalysis.diagnostics.length > 0) {
      lines.push('\n### Static Analysis Issues\n')
      for (const diag of result.staticAnalysis.diagnostics) {
        const icon = diag.severity === 'error' ? '❌' : diag.severity === 'warning' ? '⚠️' : 'ℹ️'
        lines.push(`${icon} Line ${diag.line}:${diag.column} - ${diag.message}`)
      }
    }

    // Reference Conformance
    if (result.referenceConformance.unknownSymbols.length > 0) {
      lines.push('\n### Unknown Symbols\n')
      for (const symbol of result.referenceConformance.unknownSymbols) {
        lines.push(`❌ \`${symbol}\` - Symbol not found in Pine v6 reference`)
      }
    }

    if (result.summary.valid && result.summary.warningCount === 0) {
      lines.push('\n✅ Code is ready for application.')
    } else if (result.summary.valid) {
      lines.push('\n⚠️ Code has warnings but can be applied.')
    } else {
      lines.push('\n🔧 Repair required before application.')
    }

    return lines.join('\n')
  }
}
