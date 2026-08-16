/**
 * PineChatParticipant - Native VS Code / Cursor Chat Participant for @pine
 * 
 * Supports slash commands:
 * /explain, /fix, /build, /refactor, /optimize, /migrate, /validate, /docs
 */

import * as vscode from 'vscode'
import { PineAgentController } from '../agent/PineAgentController'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'

export class PineChatParticipant {
  private static instance: PineChatParticipant | undefined
  private participant: vscode.ChatParticipant | undefined

  private constructor() {
    // Singleton
  }

  static getInstance(): PineChatParticipant {
    return (PineChatParticipant.instance ??= new PineChatParticipant())
  }

  register(context: vscode.ExtensionContext, knowledgeEngine: PineKnowledgeEngine): void {
    // Check if VS Code Chat API is available in current host
    if (typeof vscode.chat?.createChatParticipant !== 'function') {
      return
    }

    try {
      this.participant = vscode.chat.createChatParticipant(
        'pine-script-v6.agent',
        async (request, _chatContext, stream) => {
          await this.handleChatRequest(request, stream, knowledgeEngine)
        },
      )

      this.participant.iconPath = vscode.Uri.file(
        context.asAbsolutePath('media/PineLogo.png'),
      )

      context.subscriptions.push(this.participant)
    } catch (err) {
      console.warn('PineChatParticipant registration failed or not supported in this host:', err)
    }
  }

  private async handleChatRequest(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    knowledgeEngine: PineKnowledgeEngine,
  ): Promise<void> {
    const command = request.command
    const prompt = request.prompt.trim()

    stream.progress('PineForge AI is processing...')

    const editor = vscode.window.activeTextEditor
    const selection = editor?.document.getText(editor.selection) || ''
    const fullText = editor?.document.getText() || ''

    if (command === 'docs' || (!command && prompt.startsWith('docs '))) {
      this.handleDocsLookup(prompt.replace(/^docs\s+/, ''), stream, knowledgeEngine)
      return
    }

    if (command === 'validate') {
      await PineAgentController.getInstance().validateActiveScript()
      stream.markdown('✓ Ran Pine Script validation. Check the Output Channel for the complete diagnostic report.')
      return
    }

    if (command === 'optimize' || command === 'refactor') {
      stream.markdown('### Analyzing Script for Optimizations...\n')
      const controller = PineAgentController.getInstance()
      await controller.debugCode()
      stream.markdown('✓ Completed optimization analysis. Detailed report posted to Output Channel.')
      return
    }

    // Default chat & code generation flow
    stream.markdown(`**PineForge v6 Assistant**: Received request \`${prompt}\`\n\n`)
    stream.markdown('> RAG Context: Pine Script v6 Reference loaded.\n\n')

    const agent = PineAgentController.getInstance().getAgent()
    if (agent) {
      const result = await agent.run(prompt, {
        fileContent: fullText,
        selection,
        fileName: editor?.document.fileName,
      })

      stream.markdown(result.response)
    } else {
      stream.markdown('Ollama Agent is initializing. Please check the status bar.')
    }
  }

  private handleDocsLookup(
    symbolName: string,
    stream: vscode.ChatResponseStream,
    knowledgeEngine: PineKnowledgeEngine,
  ): void {
    const symbol = symbolName.trim()
    const ref = knowledgeEngine.query(symbol)

    if (!ref) {
      const lexical = knowledgeEngine.search(symbol)
      if (lexical.length > 0) {
        stream.markdown(`### Related Symbols for \`${symbol}\`:\n`)
        for (const s of lexical.slice(0, 10)) {
          stream.markdown(`- \`${s.name}\`: ${s.description || 'Pine v6 built-in'}\n`)
        }
      } else {
        stream.markdown(`No exact Pine Script v6 reference found for \`${symbol}\`.`)
      }
      return
    }

    stream.markdown(`### \`${ref.name}\` (${ref.type})\n`)
    if (ref.signature) {
      stream.markdown(`\`\`\`pine\n${ref.signature}\n\`\`\`\n`)
    }
    if (ref.description) {
      stream.markdown(`${ref.description}\n`)
    }
    if (ref.returns) {
      stream.markdown(`**Returns**: \`${ref.returns}\`\n`)
    }
  }
}
