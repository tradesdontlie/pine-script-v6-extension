/**
 * OllamaClient - HTTP client for Ollama API with streaming and tool calling support
 */

import type { LLMProvider } from '../agent/providers/LLMProvider'

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: OllamaToolCall[]
  tool_call_id?: string
  name?: string
}

export interface OllamaToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface OllamaResponse {
  model: string
  created_at: string
  message: OllamaMessage
  done: boolean
  done_reason?: string
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaStreamChunk {
  model: string
  created_at: string
  message: {
    role: string
    content: string
    tool_calls?: OllamaToolCall[]
  }
  done: boolean
}

export interface OllamaConfig {
  host: string
  model: string
  temperature: number
  maxIterations: number
}

export class OllamaClient implements LLMProvider {
  readonly id = 'ollama'
  private config: OllamaConfig

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      host: config.host ?? 'http://localhost:11434',
      model: config.model ?? 'qwen3',
      temperature: config.temperature ?? 0,
      maxIterations: config.maxIterations ?? 12,
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
    const tryFetch = async (targetUrl: string): Promise<Response> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(targetUrl, { ...options, signal: controller.signal })
        clearTimeout(timer)
        return response
      } catch (err) {
        clearTimeout(timer)
        throw err
      }
    }

    try {
      return await tryFetch(url)
    } catch (err) {
      if (url.includes('localhost')) {
        const fallbackUrl = url.replace('localhost', '127.0.0.1')
        return tryFetch(fallbackUrl)
      } else if (url.includes('127.0.0.1')) {
        const fallbackUrl = url.replace('127.0.0.1', 'localhost')
        return tryFetch(fallbackUrl)
      }
      throw err
    }
  }

  /**
   * Check if Ollama server is running
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.config.host}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.config.host}/api/tags`)
      const data = (await response.json()) as { models?: Array<{ name: string }> }
      return data.models?.map(m => m.name) ?? []
    } catch {
      return []
    }
  }

  /**
   * Chat completion with tool calling support
   */
  async chat(
    messages: OllamaMessage[],
    tools?: OllamaTool[],
    onStream?: (chunk: string) => void,
  ): Promise<OllamaResponse> {
    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: this.sanitizeMessages(messages),
      stream: Boolean(onStream),
      options: { temperature: this.config.temperature },
    }
    if (tools && tools.length > 0) {
      payload.tools = tools
    }

    let response = await fetch(`${this.config.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok && response.status === 400 && payload.tools) {
      delete payload.tools
      response = await fetch(`${this.config.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`Ollama error ${response.status}: ${response.statusText}${errText ? ` - ${errText}` : ''}`)
    }

    if (onStream && response.body) {
      return this.handleStreaming(response.body, onStream)
    }

    return this.parseJsonResponse(await response.json())
  }

  private sanitizeMessages(messages: OllamaMessage[]): unknown[] {
    return messages.map(msg => {
      const item: Record<string, unknown> = { role: msg.role, content: msg.content ?? '' }
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        item.tool_calls = msg.tool_calls.map(tc => {
          let argsObj: unknown = tc.function.arguments
          if (typeof argsObj === 'string') {
            try { argsObj = JSON.parse(argsObj) } catch { argsObj = {} }
          }
          return {
            id: tc.id,
            type: 'function',
            function: { name: tc.function.name, arguments: argsObj },
          }
        })
      }
      if (msg.tool_call_id) { item.tool_call_id = msg.tool_call_id }
      if (msg.name) { item.name = msg.name }
      return item
    })
  }

  private parseJsonResponse(raw: unknown): OllamaResponse {
    const data = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {}
    const rawMsg = (data.message ?? (data.choices as Array<{ message?: unknown }> | undefined)?.[0]?.message) as
      | Record<string, unknown>
      | undefined

    const content = typeof rawMsg?.content === 'string'
      ? rawMsg.content
      : (typeof data.response === 'string' ? data.response : '')
    const role = (rawMsg?.role === 'system' || rawMsg?.role === 'user' || rawMsg?.role === 'tool')
      ? rawMsg.role
      : 'assistant'

    const rawTools = rawMsg?.tool_calls ?? data.tool_calls
    const toolCalls = this.normalizeToolCalls(rawTools)

    return {
      model: typeof data.model === 'string' ? data.model : this.config.model,
      created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
      message: {
        role,
        content,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      done: typeof data.done === 'boolean' ? data.done : true,
    }
  }

  private normalizeToolCalls(rawTools: unknown): OllamaToolCall[] {
    if (!Array.isArray(rawTools)) {
      return []
    }
    return rawTools.map((tc: Record<string, unknown>, idx: number) => {
      const fn = ((tc.function && typeof tc.function === 'object') ? tc.function : tc) as Record<string, unknown>
      const name = typeof fn.name === 'string' ? fn.name : ''
      const rawArgs = fn.arguments
      const args = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs ?? {})
      return {
        id: typeof tc.id === 'string' ? tc.id : `call_${idx}_${Date.now()}`,
        type: 'function' as const,
        function: { name, arguments: args },
      }
    })
  }

  private async handleStreaming(
    body: unknown,
    onStream: (chunk: string) => void,
  ): Promise<OllamaResponse> {
    const reader = (body as { getReader: () => ReadableStreamDefaultReader<Uint8Array> }).getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    const toolCalls: OllamaToolCall[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) {break}
      const chunk = decoder.decode(value, { stream: true })
      const text = this.processStreamChunk(chunk, onStream, toolCalls)
      fullContent += text
    }

    return {
      model: this.config.model,
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: fullContent,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      done: true,
    }
  }

  private processStreamChunk(
    chunk: string,
    onStream: (c: string) => void,
    toolCalls: OllamaToolCall[],
  ): string {
    let text = ''
    const lines = chunk.split('\n').filter(l => l.trim().length > 0)
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === 'data: [DONE]') {continue}
      const dataStr = trimmed.startsWith('data: ') ? trimmed.slice(6).trim() : trimmed
      try {
        const parsed = JSON.parse(dataStr) as Record<string, unknown>
        const msg = parsed.message as Record<string, unknown> | undefined
        const delta = (parsed.choices as Array<{ delta?: Record<string, unknown> }> | undefined)?.[0]?.delta
        const content = typeof msg?.content === 'string'
          ? msg.content
          : (typeof delta?.content === 'string'
            ? delta.content
            : (typeof parsed.response === 'string' ? parsed.response : ''))
        if (content) {
          text += content
          onStream(content)
        }
        const chunkTools = this.normalizeToolCalls(msg?.tool_calls ?? delta?.tool_calls)
        toolCalls.push(...chunkTools)
      } catch {
        // Skip malformed chunk
      }
    }
    return text
  }

  /**
   * Execute agent loop with tool calls
   */
  async executeAgentLoop(
    systemPrompt: string,
    userMessage: string,
    tools: OllamaTool[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    onProgress?: (state: string, message: string) => void,
    onStream?: (chunk: string) => void,
  ): Promise<string> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]

    let iteration = 0
    let finalResponse = ''

    while (iteration < this.config.maxIterations) {
      onProgress?.('THINKING', `Iteration ${iteration + 1}...`)

      let iterationStream = ''
      const streamCallback = onStream ? (chunk: string) => {
        iterationStream += chunk
        onStream(chunk)
      } : undefined

      const response = await this.chat(messages, tools.length > 0 ? tools : undefined, streamCallback)
      if (!response.message) {
        throw new Error('Received empty message from Ollama')
      }

      // Check if model returned a text-based JSON tool call instead of structured tool_calls
      if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
        const textTool = this.extractTextToolCall(response.message.content || iterationStream)
        if (textTool) {
          response.message.tool_calls = [textTool]
        }
      }

      messages.push(response.message)

      if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
        finalResponse = response.message.content || iterationStream || ''
        break
      }

      // Intermediate tool-calling iteration: reset streamed text buffer for the upcoming answer
      onProgress?.('RESET_STREAM', 'Tool call dispatched.')

      await this.runToolCalls(response.message.tool_calls, messages, executeTool, onProgress)
      iteration++
    }

    return finalResponse || messages[messages.length - 1]?.content || ''
  }

  private extractTextToolCall(content: string | undefined): OllamaToolCall | null {
    if (!content) {
      return null
    }
    const trimmed = content.trim()
    let jsonStr = ''
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      jsonStr = trimmed
    } else {
      const match = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (match) {
        jsonStr = match[1]
      }
    }
    if (jsonStr) {
      try {
        const obj = JSON.parse(jsonStr) as Record<string, unknown>
        const name = (obj.name || obj.tool || obj.function) as string | undefined
        const params = obj.parameters || obj.arguments || obj.args
        if (name && typeof name === 'string' && typeof params === 'object') {
          return {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name,
              arguments: JSON.stringify(params),
            },
          }
        }
      } catch {
        // Not a valid JSON tool call
      }
    }
    return null
  }

  private async runToolCalls(
    toolCalls: OllamaToolCall[],
    messages: OllamaMessage[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    onProgress?: (state: string, message: string) => void,
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      const name = toolCall.function.name
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>
      } catch {
        args = {}
      }

      onProgress?.('TOOL', `Executing ${name}...`)
      try {
        const result = await executeTool(name, args)
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name,
          content: `Error executing ${name}: ${errorMsg}`,
        })
      }
    }
  }

  updateConfig(config: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): OllamaConfig {
    return { ...this.config }
  }
}
