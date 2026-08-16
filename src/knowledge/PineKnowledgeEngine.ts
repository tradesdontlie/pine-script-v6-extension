/**
 * PineKnowledgeEngine - Hybrid RAG system for Pine Script documentation
 * 
 * Tiers:
 * 1. Exact symbol lookup
 * 2. Lexical search
 * 3. Semantic search (optional)
 * 4. Reference graph
 */

import { PineDocsManager } from '../PineDocsManager'

export interface PineReference {
  name: string
  type: 'function' | 'method' | 'type' | 'constant' | 'annotation' | 'control' | 'variable'
  namespace?: string
  signature?: string
  description?: string
  returns?: string
  parameters?: Array<{ name: string; type: string; required?: boolean }>
  related?: string[]
  version?: number
}

export interface PineReferenceNode {
  reference: PineReference
  children: string[]
  parents: string[]
}

export class PineKnowledgeEngine {
  private docsManager: PineDocsManager
  private referenceGraph: Map<string, PineReferenceNode> = new Map()
  private lexicalIndex: Map<string, string[]> = new Map()

  constructor(docsManager: PineDocsManager) {
    this.docsManager = docsManager
    this.buildLexicalIndex()
    this.buildReferenceGraph()
  }

  /**
   * Tier 1: Exact symbol lookup
   */
  query(symbol: string): PineReference | undefined {
    // Check functions
    const functions = this.docsManager.getCompletionFunctions()
    for (const fn of functions) {
      if (fn.name === symbol) {
        return this.toReference(fn, 'function')
      }
    }

    // Check methods
    const methods = this.docsManager.getMethods()
    for (const method of methods) {
      if (method.name === symbol) {
        return this.toReference(method, 'method')
      }
    }

    // Check types
    const types = this.docsManager.getTypes()
    for (const type of types) {
      if (type.name === symbol) {
        return this.toReference(type, 'type')
      }
    }

    // Check constants
    const constants = this.docsManager.getConstants()
    for (const constant of constants) {
      if (constant.name === symbol) {
        return this.toReference(constant, 'constant')
      }
    }

    // Check controls
    const controls = this.docsManager.getControls()
    for (const control of controls) {
      if (control.name === symbol) {
        return this.toReference(control, 'control')
      }
    }

    return undefined
  }

  /**
   * Tier 2: Lexical search
   */
  search(query: string): PineReference[] {
    const queryLower = query.toLowerCase()
    const results = new Set<PineReference>()

    // Search lexical index
    const keys = Array.from(this.lexicalIndex.keys())
    for (const key of keys) {
      if (key.includes(queryLower)) {
        const symbols = this.lexicalIndex.get(key) ?? []
        for (const symbol of symbols) {
          const ref = this.query(symbol)
          if (ref) {results.add(ref)}
        }
      }
    }

    // Fallback: search descriptions
    const allDocs = [
      ...this.docsManager.getCompletionFunctions(),
      ...this.docsManager.getMethods(),
      ...this.docsManager.getTypes(),
    ]

    for (const doc of allDocs) {
      if (
        doc.description?.toLowerCase().includes(queryLower) ||
        doc.summary?.toLowerCase().includes(queryLower)
      ) {
        const ref = this.toReference(doc, 'function')
        if (ref) {results.add(ref)}
      }
    }

    return Array.from(results)
  }

  /**
   * Tier 4: Get reference with relationships
   */
  getReferenceWithGraph(symbol: string): PineReferenceNode | undefined {
    return this.referenceGraph.get(symbol)
  }

  /**
   * Get function signature
   */
  getSignature(symbol: string): string | undefined {
    const ref = this.query(symbol)
    if (!ref) {return undefined}

    if (ref.signature) {return ref.signature}

    // Build signature from parameters
    const params = ref.parameters?.map(p => {
      const req = p.required ? '' : '?'
      const type = p.type ? `: ${p.type}` : ''
      return `${p.name}${req}${type}`
    }).join(', ')

    return `${ref.name}(${params ?? ''})${ref.returns ? `: ${ref.returns}` : ''}`
  }

  /**
   * Get related references
   */
  getRelated(symbol: string): PineReference[] {
    const node = this.referenceGraph.get(symbol)
    if (!node) {return []}

    const related: PineReference[] = []
    for (const childName of node.children) {
      const ref = this.query(childName)
      if (ref) {related.push(ref)}
    }

    return related
  }

  /**
   * Get examples for a symbol
   */
  getExamples(symbol: string): string[] {
    const ref = this.query(symbol)
    if (!ref) {return []}

    // TODO: Extract examples from documentation
    return []
  }

  /**
   * Build lexical index for fuzzy search
   */
  private buildLexicalIndex(): void {
    const allDocs = [
      ...this.docsManager.getCompletionFunctions(),
      ...this.docsManager.getMethods(),
      ...this.docsManager.getTypes(),
      ...this.docsManager.getConstants(),
    ]

    for (const doc of allDocs) {
      const name = doc.name
      if (!name) {continue}

      // Index by lowercase
      const lower = name.toLowerCase()
      for (let i = 0; i < lower.length; i++) {
        for (let j = i + 1; j <= lower.length; j++) {
          const substring = lower.slice(i, j)
          const existing = this.lexicalIndex.get(substring) ?? []
          if (!existing.includes(name)) {
            existing.push(name)
            this.lexicalIndex.set(substring, existing)
          }
        }
      }

      // Index by description keywords
      const desc = doc.description ?? doc.summary ?? ''
      const keywords = desc.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      for (const keyword of keywords) {
        const existing = this.lexicalIndex.get(keyword) ?? []
        if (!existing.includes(name)) {
          existing.push(name)
          this.lexicalIndex.set(keyword, existing)
        }
      }
    }
  }

  /**
   * Build reference graph for relationships
   */
  private buildReferenceGraph(): void {
    const methods = this.docsManager.getMethods()

    // Group methods by namespace
    const namespaceMap = new Map<string, string[]>()
    for (const method of methods) {
      const parts = method.name.split('.')
      if (parts.length >= 2) {
        const namespace = parts[0]
        const existing = namespaceMap.get(namespace) ?? []
        existing.push(method.name)
        namespaceMap.set(namespace, existing)
      }
    }

    // Build graph nodes
    const allSymbols = new Set<string>()
    for (const doc of this.docsManager.getCompletionFunctions()) {
      allSymbols.add(doc.name)
    }
    for (const doc of methods) {
      allSymbols.add(doc.name)
    }

    for (const symbol of allSymbols) {
      const ref = this.query(symbol)
      if (!ref) {continue}

      const node: PineReferenceNode = {
        reference: ref,
        children: [],
        parents: [],
      }

      // Add namespace relationship
      const parts = symbol.split('.')
      if (parts.length >= 2) {
        const namespace = parts[0]
        const namespaceMethods = namespaceMap.get(namespace) ?? []
        node.children = namespaceMethods.filter(m => m !== symbol)
      }

      this.referenceGraph.set(symbol, node)
    }
  }

  /**
   * Convert doc object to PineReference
   */
  private toReference(doc: any, type: PineReference['type']): PineReference | undefined {
    if (!doc?.name) {return undefined}

    return {
      name: doc.name,
      type,
      namespace: doc.namespace,
      signature: doc.signature,
      description: doc.description ?? doc.summary,
      returns: doc.returnType ?? doc.returns,
      parameters: doc.parameters ?? doc.args,
      related: doc.related,
      version: doc.version,
    }
  }
}
