/**
 * PineReferenceManifest - Canonical Intermediate Representation (IR)
 * for Pine Script v6 Conformance & Differential Verification
 */

export type PineSymbolKind =
  | 'function'
  | 'method'
  | 'type'
  | 'constant'
  | 'variable'
  | 'annotation'
  | 'control'
  | 'enum'

export type GapSeverity = 'P0' | 'P1' | 'P2' | 'P3'

export type GapCategory =
  | 'MISSING_SYMBOL'
  | 'MISSING_PARAMETER'
  | 'EXTRA_PARAMETER'
  | 'PARAMETER_TYPE_MISMATCH'
  | 'PARAMETER_OPTIONALITY_MISMATCH'
  | 'PARAMETER_DEFAULT_MISMATCH'
  | 'RETURN_TYPE_MISMATCH'
  | 'SIGNATURE_MISMATCH'
  | 'MISSING_SYNTAX'
  | 'GRAMMAR_MISMATCH'
  | 'PARSER_MISMATCH'
  | 'SEMANTIC_MISMATCH'
  | 'VERSION_MISMATCH'
  | 'DEPRECATED_SYMBOL'
  | 'DOCUMENTATION_MISMATCH'

export interface ParameterSpec {
  name: string
  types: string[]
  optional?: boolean
  default?: string
  description?: string
}

export interface SignatureSpec {
  parameters: ParameterSpec[]
  returns: string[]
  overloads?: ParameterSpec[][]
}

export interface SymbolCapabilities {
  udt?: boolean
  footprint?: boolean
  multilineString?: boolean
  dynamicRequest?: boolean
  historyTicks?: boolean
}

export interface CanonicalSymbol {
  name: string
  kind: PineSymbolKind
  namespace?: string
  signature?: SignatureSpec
  description?: string
  version: number
  deprecated?: boolean
  capabilities?: SymbolCapabilities
  syntaxExample?: string
}

export interface PineReferenceManifest {
  version: string
  pineVersion: number
  generatedAt: string
  symbols: Record<string, CanonicalSymbol>
  languageFeatures: {
    multilineStrings: boolean
    udtSorting: boolean
    udtBinarySearch: boolean
    calcOnEveryHistoryTick: boolean
    negativeIndexing: boolean
    shortCircuit: boolean
  }
}

export interface ConformanceGap {
  id: string
  category: GapCategory
  severity: GapSeverity
  symbolName: string
  description: string
  expected: unknown
  actual: unknown
  layer: 'reference' | 'docs' | 'parser' | 'grammar' | 'completion' | 'hover' | 'signature' | 'analyzer'
}

export interface LayerScore {
  total: number
  matched: number
  percentage: number
}

export interface ConformanceScorecard {
  symbols: LayerScore
  signatures: LayerScore
  types: LayerScore
  grammar: LayerScore
  parser: LayerScore
  completions: LayerScore
  hover: LayerScore
  staticAnalysis: LayerScore
  overallPercentage: number
  criticalGapsCount: number
}
