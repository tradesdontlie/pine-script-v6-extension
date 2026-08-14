/**
 * PineReferenceNormalizer - Converts raw Pine documentation and references
 * into Canonical PineReferenceManifest IR.
 */

import {
  CanonicalSymbol,
  ParameterSpec,
  PineReferenceManifest,
  PineSymbolKind,
  SignatureSpec,
} from './PineReferenceManifest'

export interface RawDocEntry {
  name: string
  desc?: string
  info?: string
  args?: Array<{ name: string; type?: string; info?: string; default?: string; required?: boolean }>
  parameters?: Array<{ name: string; type?: string; info?: string; default?: string; required?: boolean }>
  returns?: string | string[]
  syntax?: string
  example?: string
  version?: number
  deprecated?: boolean
}

export class PineReferenceNormalizer {
  static normalizeRawDocs(
    rawDocs: Record<string, Array<{ docs: RawDocEntry[] }>>,
    version = '6.0.0-snapshot',
  ): PineReferenceManifest {
    const symbols: Record<string, CanonicalSymbol> = {}

    const categoryMap: Array<[string, PineSymbolKind]> = [
      ['functions', 'function'],
      ['methods', 'method'],
      ['types', 'type'],
      ['variables', 'variable'],
      ['constants', 'constant'],
      ['annotations', 'annotation'],
      ['controls', 'control'],
    ]

    for (const [category, kind] of categoryMap) {
      const entries = rawDocs[category]?.[0]?.docs ?? []
      for (const entry of entries) {
        if (!entry.name) {continue}
        const sym = this.normalizeSymbol(entry, kind)
        symbols[sym.name] = sym
      }
    }

    return {
      version,
      pineVersion: 6,
      generatedAt: new Date().toISOString(),
      symbols,
      languageFeatures: {
        multilineStrings: true,
        udtSorting: true,
        udtBinarySearch: true,
        calcOnEveryHistoryTick: true,
        negativeIndexing: true,
        shortCircuit: true,
      },
    }
  }

  static normalizeSymbol(entry: RawDocEntry, kind: PineSymbolKind): CanonicalSymbol {
    const parts = entry.name.split('.')
    const namespace = parts.length > 1 ? parts.slice(0, -1).join('.') : undefined
    const signature = this.buildSignature(entry, kind)

    return {
      name: entry.name,
      kind,
      namespace,
      signature,
      description: entry.info || entry.desc,
      version: entry.version ?? 6,
      deprecated: entry.deprecated ?? false,
      syntaxExample: entry.syntax || entry.example,
    }
  }

  private static buildSignature(entry: RawDocEntry, kind: PineSymbolKind): SignatureSpec | undefined {
    if (kind !== 'function' && kind !== 'method' && kind !== 'type') {
      return undefined
    }

    const rawParams = entry.args || entry.parameters || []
    const parameters: ParameterSpec[] = rawParams.map(p => ({
      name: p.name,
      types: this.parseTypeUnion(p.type ?? 'series float'),
      optional: p.required === false || p.default !== undefined,
      default: p.default,
      description: p.info,
    }))

    const rawReturns = entry.returns
    const returns = Array.isArray(rawReturns)
      ? rawReturns
      : rawReturns
        ? this.parseTypeUnion(rawReturns)
        : ['void']

    return { parameters, returns }
  }

  private static parseTypeUnion(typeStr: string): string[] {
    if (!typeStr) {return ['any']}
    return typeStr
      .split(/\||,/)
      .map(t => t.trim())
      .filter(Boolean)
  }
}
