/**
 * Provider-agnostic interface for the LLM backend PineAgent drives its tool-
 * calling loop against. Modeled directly on OllamaClient's existing public
 * surface (which PineAgent already depends on) so OllamaClient can implement
 * this interface with zero changes to its own logic — the goal is to widen
 * the seam PineAgent talks through, not to touch the one, working, tested-
 * by-usage Ollama code path.
 */

import type { OllamaTool } from '../../ollama/OllamaClient'

export interface LLMProviderConfig {
  model: string
  temperature: number
  maxIterations: number
  /** Only meaningful for providers that talk to a self-hosted endpoint (e.g. Ollama). */
  host?: string
}

export interface LLMProvider {
  readonly id: string

  healthCheck(): Promise<boolean>
  getModels(): Promise<string[]>

  executeAgentLoop(
    systemPrompt: string,
    userMessage: string,
    tools: OllamaTool[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    onProgress?: (state: string, message: string) => void,
    onStream?: (chunk: string) => void,
  ): Promise<string>

  updateConfig(config: Partial<LLMProviderConfig>): void
  getConfig(): LLMProviderConfig
}
