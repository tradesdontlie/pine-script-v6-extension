/**
 * LLMProvider backed by VS Code's built-in Language Model API
 * (vscode.lm.selectChatModels), typically resolving to the user's GitHub
 * Copilot subscription. Zero-config: no API key, no separate HTTP client —
 * VS Code handles model access and consent. Requires a VS Code host recent
 * enough to expose vscode.lm; isAvailable() feature-detects this at runtime
 * so the extension degrades gracefully on older hosts instead of crashing.
 *
 * VS Code's chat message API has no "system" role — the system prompt is
 * sent as an initial User message, the standard workaround for this API.
 */

import * as vscode from 'vscode'
import type { OllamaTool } from '../../ollama/OllamaClient'
import type { LLMProvider, LLMProviderConfig } from './LLMProvider'

export interface VSCodeLMConfig extends LLMProviderConfig {
  vendor?: string
  family?: string
}

export class VSCodeLMProvider implements LLMProvider {
  readonly id = 'vscode-lm'
  private config: VSCodeLMConfig

  constructor(config: Partial<VSCodeLMConfig> = {}) {
    this.config = {
      model: config.model ?? '',
      temperature: config.temperature ?? 0,
      maxIterations: config.maxIterations ?? 12,
      vendor: config.vendor,
      family: config.family ?? 'gpt-4o',
    }
  }

  static isAvailable(): boolean {
    return typeof vscode.lm?.selectChatModels === 'function'
  }

  async healthCheck(): Promise<boolean> {
    if (!VSCodeLMProvider.isAvailable()) {return false}
    try {
      const models = await this.selectModels()
      return models.length > 0
    } catch {
      return false
    }
  }

  async getModels(): Promise<string[]> {
    if (!VSCodeLMProvider.isAvailable()) {return []}
    try {
      const models = await vscode.lm.selectChatModels()
      return models.map(m => `${m.vendor}/${m.family}`)
    } catch {
      return []
    }
  }

  private async selectModels(): Promise<vscode.LanguageModelChat[]> {
    const selector: vscode.LanguageModelChatSelector = {}
    if (this.config.vendor) {selector.vendor = this.config.vendor}
    if (this.config.family) {selector.family = this.config.family}
    return vscode.lm.selectChatModels(selector)
  }

  async executeAgentLoop(
    systemPrompt: string,
    userMessage: string,
    tools: OllamaTool[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    onProgress?: (state: string, message: string) => void,
    onStream?: (chunk: string) => void,
  ): Promise<string> {
    if (!VSCodeLMProvider.isAvailable()) {
      throw new Error('VS Code Language Model API is not available in this host (requires a recent VS Code with an active model provider, e.g. GitHub Copilot).')
    }

    const models = await this.selectModels()
    if (models.length === 0) {
      throw new Error('No VS Code language models available. Ensure GitHub Copilot (or another chat model provider) is installed and you are signed in.')
    }
    const model = models[0]

    const lmTools: vscode.LanguageModelChatTool[] = tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      inputSchema: t.function.parameters,
    }))

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(userMessage),
    ]

    let iteration = 0
    let finalResponse = ''
    const cancellationToken = new vscode.CancellationTokenSource().token

    while (iteration < this.config.maxIterations) {
      onProgress?.('THINKING', `Iteration ${iteration + 1}...`)

      // eslint-disable-next-line no-await-in-loop
      const response = await model.sendRequest(
        messages,
        { tools: lmTools.length > 0 ? lmTools : undefined },
        cancellationToken,
      )

      let textContent = ''
      const toolCalls: vscode.LanguageModelToolCallPart[] = []
      // eslint-disable-next-line no-await-in-loop
      for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
          textContent += part.value
          onStream?.(part.value)
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
          toolCalls.push(part)
        }
      }

      if (toolCalls.length === 0) {
        finalResponse = textContent
        break
      }

      onProgress?.('RESET_STREAM', 'Tool call dispatched.')

      const assistantContent: Array<vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart> = []
      if (textContent) {assistantContent.push(new vscode.LanguageModelTextPart(textContent))}
      assistantContent.push(...toolCalls)
      messages.push(vscode.LanguageModelChatMessage.Assistant(assistantContent))

      const toolResultParts: vscode.LanguageModelToolResultPart[] = []
      for (const call of toolCalls) {
        onProgress?.('TOOL', `Executing ${call.name}...`)
        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await executeTool(call.name, call.input as Record<string, unknown>)
          const resultText = typeof result === 'string' ? result : JSON.stringify(result)
          toolResultParts.push(new vscode.LanguageModelToolResultPart(call.callId, [new vscode.LanguageModelTextPart(resultText)]))
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          toolResultParts.push(new vscode.LanguageModelToolResultPart(call.callId, [new vscode.LanguageModelTextPart(`Error executing ${call.name}: ${errorMsg}`)]))
        }
      }
      messages.push(vscode.LanguageModelChatMessage.User(toolResultParts))

      iteration++
    }

    return finalResponse
  }

  updateConfig(config: Partial<VSCodeLMConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): VSCodeLMConfig {
    return { ...this.config }
  }
}
