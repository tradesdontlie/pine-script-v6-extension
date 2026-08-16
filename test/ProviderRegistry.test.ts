import { describe, it, expect } from 'vitest'
import { createLLMProvider } from '../src/agent/providers/ProviderRegistry'
import { OllamaClient } from '../src/ollama/OllamaClient'
import { VSCodeLMProvider } from '../src/agent/providers/VSCodeLMProvider'

describe('createLLMProvider', () => {
  it('defaults to ollama when no providerId is given', () => {
    const provider = createLLMProvider({})
    expect(provider).toBeInstanceOf(OllamaClient)
    expect(provider.id).toBe('ollama')
  })

  it('creates an OllamaClient for providerId "ollama"', () => {
    const provider = createLLMProvider({ providerId: 'ollama', ollamaHost: 'http://localhost:11434', model: 'qwen3' })
    expect(provider).toBeInstanceOf(OllamaClient)
    expect(provider.getConfig().model).toBe('qwen3')
  })

  it('creates a VSCodeLMProvider for providerId "vscode-lm"', () => {
    const provider = createLLMProvider({ providerId: 'vscode-lm' })
    expect(provider).toBeInstanceOf(VSCodeLMProvider)
    expect(provider.id).toBe('vscode-lm')
  })

  it('passes maxIterations/temperature through to the ollama provider', () => {
    const provider = createLLMProvider({ providerId: 'ollama', maxIterations: 5, temperature: 0.5 })
    const config = provider.getConfig()
    expect(config.maxIterations).toBe(5)
    expect(config.temperature).toBe(0.5)
  })
})

describe('OllamaClient implements LLMProvider', () => {
  it('exposes a stable id', () => {
    const client = new OllamaClient()
    expect(client.id).toBe('ollama')
  })
})

describe('VSCodeLMProvider', () => {
  it('reports unavailable when vscode.lm is not present (test mock has no lm namespace)', () => {
    expect(VSCodeLMProvider.isAvailable()).toBe(false)
  })

  it('healthCheck resolves false when unavailable', async () => {
    const provider = new VSCodeLMProvider()
    await expect(provider.healthCheck()).resolves.toBe(false)
  })

  it('getModels resolves to an empty array when unavailable', async () => {
    const provider = new VSCodeLMProvider()
    await expect(provider.getModels()).resolves.toEqual([])
  })

  it('executeAgentLoop rejects with a clear error when unavailable', async () => {
    const provider = new VSCodeLMProvider()
    await expect(
      provider.executeAgentLoop('system', 'hello', [], async () => 'ok'),
    ).rejects.toThrow(/Language Model API is not available/)
  })

  it('updateConfig/getConfig round-trip', () => {
    const provider = new VSCodeLMProvider({ model: 'a', temperature: 0.2, maxIterations: 3 })
    provider.updateConfig({ temperature: 0.9 })
    const config = provider.getConfig()
    expect(config.temperature).toBe(0.9)
    expect(config.maxIterations).toBe(3)
  })
})
