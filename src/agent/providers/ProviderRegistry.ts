/**
 * Resolves the active LLMProvider from PineForge settings. Defaults to
 * Ollama (the existing, working default) so upgrading is behavior-neutral
 * for anyone who hasn't touched the new pineForge.provider setting.
 */

import { OllamaClient } from '../../ollama/OllamaClient'
import { VSCodeLMProvider } from './VSCodeLMProvider'
import type { LLMProvider } from './LLMProvider'

export type PineForgeProviderId = 'ollama' | 'vscode-lm'

export interface ProviderRegistryConfig {
  providerId?: PineForgeProviderId
  ollamaHost?: string
  model?: string
  temperature?: number
  maxIterations?: number
}

export function createLLMProvider(config: ProviderRegistryConfig): LLMProvider {
  const providerId = config.providerId ?? 'ollama'

  if (providerId === 'vscode-lm') {
    return new VSCodeLMProvider({
      model: config.model,
      temperature: config.temperature ?? 0,
      maxIterations: config.maxIterations ?? 12,
    })
  }

  return new OllamaClient({
    host: config.ollamaHost ?? 'http://localhost:11434',
    model: config.model ?? 'qwen3',
    temperature: config.temperature ?? 0,
    maxIterations: config.maxIterations ?? 12,
  })
}
