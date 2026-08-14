/**
 * Pine Agent - Main orchestrator for PineForge
 */

import { OllamaClient, OllamaTool } from '../ollama/OllamaClient'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'
import { PineAgentState, AgentState } from './PineAgentState'
import { PineAgentPolicy } from './PineAgentPolicy'
import { PineTool, PineToolResult } from '../tools/PineTool'

export interface PineAgentConfig {
  ollamaHost?: string
  model?: string
  maxIterations?: number
  autoRepair?: boolean
}

export interface AgentProgress {
  state: AgentState
  message: string
  iteration?: number
}

export class PineAgent {
  private client: OllamaClient
  private state: PineAgentState
  private policy: PineAgentPolicy
  private tools: Map<string, PineTool> = new Map()
  private knowledgeEngine: PineKnowledgeEngine

  constructor(
    knowledgeEngine: PineKnowledgeEngine,
    config: PineAgentConfig = {},
  ) {
    this.knowledgeEngine = knowledgeEngine
    this.client = new OllamaClient({
      host: config.ollamaHost ?? 'http://localhost:11434',
      model: config.model ?? 'qwen3',
      maxIterations: config.maxIterations ?? 12,
    })
    this.state = new PineAgentState(config.maxIterations ?? 12)
    this.policy = new PineAgentPolicy({
      autoRepair: config.autoRepair ?? true,
    })
  }

  /**
   * Register a tool
   */
  registerTool(tool: PineTool): void {
    this.tools.set(tool.definition.name, tool)
  }

  /**
   * Get all registered tools as Ollama tools
   */
  getOllamaTools(): OllamaTool[] {
    return Array.from(this.tools.values()).map(t => t.toOllamaTool())
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<PineToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        content: `Unknown tool: ${name}`,
      }
    }

    try {
      return await tool.execute(args)
    } catch (error: any) {
      return {
        success: false,
        content: `Tool error: ${error.message}`,
      }
    }
  }

  /**
   * Run the agent with a user request
   */
  async run(
    userRequest: string,
    context: {
      fileContent?: string
      fileName?: string
      selection?: string
      diagnostics?: string
    },
    onProgress?: (progress: AgentProgress) => void,
  ): Promise<{
      success: boolean
      response: string
      state: AgentState
    }> {
    // Build context
    const builtContext = this.buildContext(context)

    // Start agent loop
    this.state.transition('PLANNING', 'Starting agent loop')
    onProgress?.({ state: 'PLANNING', message: 'Planning...' })

    try {
      const systemPrompt = this.policy.getSystemPrompt()

      const response = await this.client.executeAgentLoop(
        systemPrompt,
        `${builtContext}\n\nUser Request: ${userRequest}`,
        this.getOllamaTools(),
        async (name, args) => {
          const result = await this.executeTool(name, args)

          // Update state based on tool execution
          if (name === 'pine_validate') {
            const valid = result.success
            if (valid) {
              this.state.transition('READY_TO_APPLY', 'Validation passed')
            } else if (this.policy.getPolicy().autoRepair) {
              this.state.transition('REPAIRING', 'Validation failed, repairing...')
            }
            onProgress?.({
              state: this.state.state,
              message: result.content.slice(0, 100),
              iteration: this.state.iterations,
            })
          }

          return result.content
        },
        (ollamaState, message) => {
          onProgress?.({
            state: this.state.state,
            message,
            iteration: this.state.iterations,
          })
        },
      )

      this.state.transition('APPLIED', 'Agent completed')

      return {
        success: true,
        response,
        state: this.state.state,
      }
    } catch (error: any) {
      this.state.transition('ERROR', error.message)
      return {
        success: false,
        response: error.message,
        state: 'ERROR',
      }
    }
  }

  /**
   * Build context for the agent
   */
  private buildContext(context: {
    fileContent?: string
    fileName?: string
    selection?: string
    diagnostics?: string
  }): string {
    const lines: string[] = []

    lines.push('## Context')

    if (context.fileName) {
      lines.push(`\n### Current File: ${context.fileName}`)
    }

    if (context.fileContent) {
      lines.push('\n```pine')
      // Truncate if too long
      const content = context.fileContent.length > 5000
        ? context.fileContent.slice(0, 5000) + '\n... [truncated]'
        : context.fileContent
      lines.push(content)
      lines.push('```')
    }

    if (context.selection) {
      lines.push('\n### Selection:')
      lines.push('```pine')
      lines.push(context.selection)
      lines.push('```')
    }

    if (context.diagnostics) {
      lines.push('\n### Diagnostics:')
      lines.push(context.diagnostics)
    }

    return lines.join('\n')
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return this.state.state
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.state.reset()
  }

  /**
   * Check health
   */
  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck()
  }

  /**
   * Get Ollama client instance
   */
  getClient(): OllamaClient {
    return this.client
  }
}
