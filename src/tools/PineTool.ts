/**
 * Base Tool interface for Pine Forge tools
 */

export interface PineToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      required?: boolean
      enum?: string[]
    }>
    required?: string[]
  }
}

export interface PineToolResult {
  success: boolean
  content: string
  requiresConfirmation?: boolean
  metadata?: Record<string, unknown>
}

export abstract class PineTool {
  abstract readonly definition: PineToolDefinition
  abstract execute(args: Record<string, unknown>): Promise<PineToolResult>

  /**
   * Convert to Ollama tool format
   */
  toOllamaTool(): import('../ollama/OllamaClient').OllamaTool {
    return {
      type: 'function',
      function: {
        name: this.definition.name,
        description: this.definition.description,
        parameters: this.definition.parameters as Record<string, unknown>,
      },
    }
  }
}
