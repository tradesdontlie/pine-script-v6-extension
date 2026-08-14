/**
 * PineSearchDocsTool - Search Pine documentation (Tier 1: Exact lookup)
 */

import { PineTool, PineToolDefinition, PineToolResult } from './PineTool'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'

export class PineSearchDocsTool extends PineTool {
  readonly definition: PineToolDefinition = {
    name: 'pine_search_docs',
    description: 'Search Pine Script documentation by query. Returns exact matches and related references.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The symbol name or search query (e.g., "request.security", "array.sort", "box.new")',
        },
      },
      required: ['query'],
    },
  }

  constructor(private knowledgeEngine: PineKnowledgeEngine) {
    super()
  }

  async execute(args: Record<string, unknown>): Promise<PineToolResult> {
    const query = args.query as string

    if (!query || typeof query !== 'string') {
      return {
        success: false,
        content: 'Error: query parameter is required and must be a string',
      }
    }

    // Try exact lookup first
    let ref = this.knowledgeEngine.query(query)

    if (ref) {
      const content = this.formatReference(ref)
      return {
        success: true,
        content,
        metadata: { type: 'exact', symbol: query },
      }
    }

    // Fallback to lexical search
    const results = this.knowledgeEngine.search(query)
    if (results.length > 0) {
      const content = results.slice(0, 5).map(r => this.formatReference(r)).join('\n\n---\n\n')
      return {
        success: true,
        content: `Found ${results.length} matches:\n\n${content}`,
        metadata: { type: 'search', count: results.length },
      }
    }

    return {
      success: false,
      content: `No documentation found for "${query}"`,
    }
  }

  private formatReference(ref: import('../knowledge/PineKnowledgeEngine').PineReference): string {
    let output = `**${ref.name}** (${ref.type})\n`

    if (ref.signature) {
      output += `\nSignature: \`${ref.signature}\`\n`
    } else if (ref.parameters) {
      const params = ref.parameters.map(p => {
        const req = p.required ? '' : '?'
        const type = p.type ? `: ${p.type}` : ''
        return `${p.name}${req}${type}`
      }).join(', ')
      output += `\nSignature: \`${ref.name}(${params})${ref.returns ? `: ${ref.returns}` : ''}\`\n`
    }

    if (ref.description) {
      output += `\n${ref.description}\n`
    }

    if (ref.related && ref.related.length > 0) {
      output += `\nRelated: ${ref.related.join(', ')}\n`
    }

    return output
  }
}
