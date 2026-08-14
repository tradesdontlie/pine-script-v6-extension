/**
 * OllamaClient - HTTP client for Ollama API with streaming and tool calling support
 */

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

export class OllamaClient {
  private config: OllamaConfig

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      host: config.host ?? 'http://localhost:11434',
      model: config.model ?? 'qwen3',
      temperature: config.temperature ?? 0,
      maxIterations: config.maxIterations ?? 12,
    }
  }

  /**
   * Check if Ollama server is running
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.host}/api/tags`)
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
      const response = await fetch(`${this.config.host}/api/tags`)
      const data = (await response.json()) as { models?: Array<{ name: string }> }
      return data.models?.map((m: any) => m.name) ?? []
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
    const response = await fetch(`${this.config.host}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        tools,
        stream: !!onStream,
        temperature: this.config.temperature,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
    }

    if (onStream && response.body) {
      return this.handleStreaming(response.body, onStream)
    }

    return response.json() as Promise<OllamaResponse>
  }

  /**
   * Handle streaming response
   */
  private async handleStreaming(
    body: any,
    onStream: (chunk: string) => void,
  ): Promise<OllamaResponse> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let toolCalls: OllamaToolCall[] = []
    let lastMessage: OllamaResponse | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) {break}

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {continue}

          try {
            const parsed: OllamaStreamChunk = JSON.parse(data)
            if (parsed.message.content) {
              fullContent += parsed.message.content
              onStream(parsed.message.content)
            }
            if (parsed.message.tool_calls) {
              toolCalls = [...toolCalls, ...parsed.message.tool_calls]
            }
            if (parsed.done) {
              lastMessage = {
                model: parsed.model,
                created_at: parsed.created_at,
                message: {
                  role: 'assistant',
                  content: fullContent,
                  tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
                },
                done: true,
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    if (!lastMessage) {
      throw new Error('No response from Ollama')
    }

    return lastMessage
  }

  /**
   * Execute agent loop with tool calls
   */
  async executeAgentLoop(
    systemPrompt: string,
    userMessage: string,
    tools: OllamaTool[],
    executeTool: (name: string, args: any) => Promise<any>,
    onProgress?: (state: string, message: string) => void,
  ): Promise<string> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]

    let iteration = 0
    let finalResponse = ''

    while (iteration < this.config.maxIterations) {
      onProgress?.('THINKING', `Iteration ${iteration + 1}...`)

      const response = await this.chat(messages, tools)
      messages.push(response.message)

      if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
        finalResponse = response.message.content
        break
      }

      for (const toolCall of response.message.tool_calls) {
        const { name, arguments: argsStr } = toolCall.function
        const args = JSON.parse(argsStr)

        onProgress?.('TOOL', `Executing ${name}...`)

        try {
          const result = await executeTool(name, args)
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          })
        } catch (error: any) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name,
            content: `Error executing ${name}: ${error.message}`,
          })
        }
      }

      iteration++
    }

    return finalResponse
  }

  updateConfig(config: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): OllamaConfig {
    return { ...this.config }
  }
}
