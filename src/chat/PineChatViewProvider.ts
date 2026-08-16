/**
 * PineChatViewProvider - Dedicated Sidebar Webview Chat Interface for PineForge
 * Works natively in Cursor and VS Code sidebar with live streaming, settings, and execution transcripts.
 */

import * as vscode from 'vscode'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'
import { PineAgentController } from '../agent/PineAgentController'
import { PineValidateTool } from '../tools/PineValidateTool'

interface TranscriptStep { time: string; state: string; message: string }
interface WebviewConfig { host?: string; model?: string; temperature?: number; autoRepair?: boolean; maxIterations?: number }
interface WebviewMessage {
  type: string; prompt?: string; code?: string; action?: string; mode?: 'replace' | 'insert'
  includeContext?: boolean; config?: WebviewConfig
}

export class PineChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pineforge.chatView'
  private view?: vscode.WebviewView

  constructor(private readonly extensionUri: vscode.Uri, private readonly knowledgeEngine: PineKnowledgeEngine) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] }
    webviewView.webview.html = this.getHtml(webviewView.webview)
    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => this.handleMessage(msg))

    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(() => {
      void this.postStatus()
    })
    webviewView.onDidDispose(() => {
      activeEditorListener.dispose()
    })

    void this.postStatus()
  }

  public async sendExternalPrompt(prompt: string): Promise<void> {
    await vscode.commands.executeCommand('pineforge.chatView.focus')
    await this.processPrompt(prompt, true)
  }

  private getActivePineEditor(): vscode.TextEditor | undefined {
    if (vscode.window.activeTextEditor) {
      return vscode.window.activeTextEditor
    }
    const pineEditor = vscode.window.visibleTextEditors.find(
      e => e.document.languageId === 'pine' || e.document.fileName.endsWith('.pine') || e.document.fileName.endsWith('.pinescript'),
    )
    return pineEditor ?? vscode.window.visibleTextEditors[0]
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'webviewReady':
      case 'refreshStatus':
        await this.postStatus()
        break
      case 'sendPrompt':
        if (message.prompt) { await this.processPrompt(message.prompt, Boolean(message.includeContext)) }
        break
      case 'quickAction':
        if (message.action) { await this.processAction(message.action) }
        break
      case 'applyCode':
        if (message.code) { await this.applyCodeToEditor(message.code, message.mode ?? 'replace') }
        break
      case 'updateConfig':
        if (message.config) { await this.updateConfiguration(message.config) }
        break
      case 'openVSCodeSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'pineForge')
        break
      default:
        break
    }
  }

  private async updateConfiguration(config: WebviewConfig): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('pineForge')
    if (config.host) { await cfg.update('ollama.host', config.host, vscode.ConfigurationTarget.Global) }
    if (config.model) { await cfg.update('ollama.model', config.model, vscode.ConfigurationTarget.Global) }
    if (typeof config.temperature === 'number') { await cfg.update('ollama.temperature', config.temperature, vscode.ConfigurationTarget.Global) }
    if (typeof config.autoRepair === 'boolean') { await cfg.update('agent.autoRepair', config.autoRepair, vscode.ConfigurationTarget.Global) }
    if (typeof config.maxIterations === 'number') { await cfg.update('agent.maxIterations', config.maxIterations, vscode.ConfigurationTarget.Global) }
    PineAgentController.getInstance().reloadAgent()
    vscode.window.showInformationMessage('PineForge: Configuration saved.')
    await this.postStatus()
  }

  private async processPrompt(prompt: string, includeContext: boolean): Promise<void> {
    const editor = this.getActivePineEditor()
    const fileContent = (includeContext && editor) ? editor.document.getText() : undefined
    const selection = (includeContext && editor) ? editor.document.getText(editor.selection) : undefined
    const fileName = editor?.document.fileName

    const transcript: TranscriptStep[] = []
    this.postMessage({ type: 'startStreaming', userPrompt: prompt })
    const outputChannel = PineAgentController.getInstance().getOutputChannel()
    outputChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] === PineForge Chat Request ===\nUser: ${prompt}`)

    try {
      const config = vscode.workspace.getConfiguration('pineForge')
      const host = config.get<string>('ollama.host', 'http://localhost:11434')
      const model = config.get<string>('ollama.model', 'minimax-m3:cloud')
      const temperature = config.get<number>('ollama.temperature', 0)
      const maxIterations = config.get<number>('agent.maxIterations', 12)

      const agent = PineAgentController.getInstance().getAgent()
      const client = agent.getProvider()
      client.updateConfig({ host, model, temperature, maxIterations })

      const isHealthy = await agent.healthCheck().catch(() => false)
      if (!isHealthy) {
        throw new Error(
          `Cannot connect to Ollama at ${host}.\n` +
          `Please make sure Ollama is running ('ollama serve') and model '${model}' is downloaded.\n` +
          'You can update Ollama host/model settings using the ⚙️ Settings button above.',
        )
      }

      const tools = agent.getOllamaTools()
      const systemPrompt = 'You are PineForge AI, expert TradingView Pine Script v6 engineering assistant.\n' +
        'Rules:\n' +
        '1. Always use Pine Script v6 syntax (@version=6) with indicator() or strategy() declaration.\n' +
        '2. NEVER use semicolons (;) at line endings. Pine Script uses indentation and newlines.\n' +
        '3. Use standard Pine v6 inputs: input.int(), input.float(), input.bool(), input.string(), input.color().\n' +
        '4. User-defined types use: type TypeName\n    float field1\n    int field2 (never use struct or C-syntax).\n' +
        '5. Use standard plotting functions: plot(), plotshape(), plotchar(), line.new(), box.new(), label.new().\n' +
        '6. For collections use: array.new<float>(), matrix.new<float>(), map.new<string, float>().\n' +
        '7. Never invent fake APIs. Output valid, complete, copy-pasteable Pine Script v6 code in ```pine code blocks.'
      
      let userMsg = prompt
      if (fileContent) {
        userMsg = `Current active script (${fileName ?? 'script.pine'}):\n\`\`\`pine\n${fileContent}\n\`\`\`\n${selection ? `Selected text:\n\`\`\`pine\n${selection}\n\`\`\`\n` : ''}\nUser Request: ${prompt}`
      }

      const onProgress = (state: string, msg: string) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const step: TranscriptStep = { time, state, message: msg }
        transcript.push(step)
        this.postMessage({ type: 'progress', step, transcript })
        if (state !== 'RESET_STREAM') {
          outputChannel.appendLine(`[${time}] [${state}] ${msg}`)
        }
      }

      const onStream = (chunk: string) => {
        this.postMessage({ type: 'streamChunk', chunk })
      }

      const response = await client.executeAgentLoop(
        systemPrompt,
        userMsg,
        tools,
        async (name, args) => {
          const res = await agent.executeTool(name, args as Record<string, unknown>)
          return res.content
        },
        onProgress,
        onStream,
      )

      outputChannel.appendLine(`=== Agent Response ===\n${response}\n---`)
      this.postMessage({ type: 'streamEnd', content: response, transcript })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      outputChannel.appendLine(`[ERROR] ${errorMsg}`)
      this.postMessage({ type: 'streamError', error: errorMsg, transcript })
    }
  }

  private async processAction(action: string): Promise<void> {
    const editor = this.getActivePineEditor()
    const code = editor?.document.getText() ?? ''

    if (action === 'validate') {
      if (!code.trim()) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        this.postMessage({
          type: 'botResponse',
          content: '### Pine Script Validation\n\n⚠️ **No active Pine Script document found.**\nPlease open a `.pine` file in the editor to run validation.',
          transcript: [{ time, state: 'VALIDATE', message: 'No active Pine Script found to validate.' }],
        })
        return
      }
      const tool = new PineValidateTool(this.knowledgeEngine)
      const res = await tool.execute({ code, mode: 'full' })
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      this.postMessage({
        type: 'botResponse',
        content: `### Pine Script Validation Report\n\n${res.content}`,
        transcript: [{ time, state: 'VALIDATE', message: 'Executed full Pine v6 conformance validation.' }],
      })
      return
    }

    if (!code.trim() && action !== 'explain') {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      this.postMessage({
        type: 'botResponse',
        content: `⚠️ **No active Pine Script document found.**\nPlease open a \`.pine\` file in the editor to use the **${action}** action.`,
        transcript: [{ time, state: 'ACTION', message: `Action ${action} aborted: no active script.` }],
      })
      return
    }

    const prompts: Record<string, string> = {
      explain: 'Explain the logic, indicators, and structure of this Pine Script v6 file in detail.',
      fix: 'Diagnose syntax errors, repainting issues, and runtime na bugs in this script and provide the corrected Pine Script v6 code.',
      optimize: 'Optimize this Pine Script v6 code for calculation performance, memory efficiency, and caching while maintaining exact TradingView Pine Script v6 syntax. Provide the full valid v6 script.',
      migrate: 'Migrate this Pine Script code to Pine Script v6 standard syntax, utilizing new v6 features. Provide the full valid v6 script.',
    }

    const promptText = prompts[action] ?? `Execute ${action} on the current script.`
    await this.processPrompt(promptText, true)
  }

  private isFullScript(code: string): boolean {
    const trimmed = code.trim()
    return (
      trimmed.startsWith('//@version') ||
      trimmed.includes('//@version=') ||
      /^indicator\s*\(/m.test(trimmed) ||
      /^strategy\s*\(/m.test(trimmed) ||
      /^library\s*\(/m.test(trimmed)
    )
  }

  private findSnippetTargetRange(doc: vscode.TextDocument, snippet: string): vscode.Range | undefined {
    const docText = doc.getText()
    const docLines = docText.split(/\r?\n/)
    const snippetLines = snippet.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    if (snippetLines.length === 0 || docLines.length === 0) { return undefined }

    // 1. Exact substring match
    const exactIdx = docText.indexOf(snippet.trim())
    if (exactIdx >= 0) {
      return new vscode.Range(doc.positionAt(exactIdx), doc.positionAt(exactIdx + snippet.trim().length))
    }

    // 2. Sliding window token-similarity matcher
    const snipLen = snippetLines.length
    let bestStart = -1
    let bestEnd = -1
    let bestScore = 0

    // Extract significant keywords/tokens from snippet (ignore pure symbols)
    const snipTokens = snippet.split(/[\s(),.:=]+/).filter(t => t.length > 2)

    for (let i = 0; i < docLines.length; i++) {
      // Test window sizes around the snippet length
      const minW = Math.max(1, snipLen - 2)
      const maxW = Math.min(docLines.length - i, snipLen + 3)
      for (let w = minW; w <= maxW; w++) {
        const windowText = docLines.slice(i, i + w).join('\n')
        let matched = 0
        for (const tok of snipTokens) {
          if (windowText.includes(tok)) {
            matched++
          }
        }
        const score = snipTokens.length > 0 ? matched / snipTokens.length : 0
        if (score > bestScore && score >= 0.5) {
          bestScore = score
          bestStart = i
          bestEnd = i + w - 1
        }
      }
    }

    if (bestStart >= 0 && bestEnd >= bestStart) {
      return new vscode.Range(
        new vscode.Position(bestStart, 0),
        new vscode.Position(bestEnd, docLines[bestEnd].length),
      )
    }

    return undefined
  }

  private async applyCodeToEditor(code: string, mode: 'replace' | 'insert'): Promise<void> {
    const editor = this.getActivePineEditor()
    if (!editor) {
      const doc = await vscode.workspace.openTextDocument({ language: 'pine', content: code })
      await vscode.window.showTextDocument(doc)
      return
    }

    const isFull = this.isFullScript(code)
    let appliedMessage = 'PineForge: Applied code to editor.'

    await editor.edit(editBuilder => {
      if (mode === 'insert') {
        editBuilder.insert(editor.selection.active, code)
        appliedMessage = 'PineForge: Inserted snippet at cursor.'
      } else if (!editor.selection.isEmpty) {
        editBuilder.replace(editor.selection, code)
        appliedMessage = 'PineForge: Replaced selection.'
      } else if (isFull) {
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length),
        )
        editBuilder.replace(fullRange, code)
        appliedMessage = 'PineForge: Replaced entire script.'
      } else {
        const targetRange = this.findSnippetTargetRange(editor.document, code)
        if (targetRange) {
          editBuilder.replace(targetRange, code)
          appliedMessage = `PineForge: Replaced lines ${targetRange.start.line + 1}–${targetRange.end.line + 1}.`
        } else {
          editBuilder.insert(editor.selection.active, code)
          appliedMessage = 'PineForge: Inserted snippet at cursor (select lines first to replace a specific section).'
        }
      }
    })

    vscode.window.showInformationMessage(appliedMessage)
  }

  private async postStatus(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('pineForge')
      let configuredModel = config.get<string>('ollama.model', 'minimax-m3:cloud')
      const host = config.get<string>('ollama.host', 'http://localhost:11434')
      const temperature = config.get<number>('ollama.temperature', 0)
      const autoRepair = config.get<boolean>('agent.autoRepair', true)
      const maxIterations = config.get<number>('agent.maxIterations', 12)
      const activeFile = this.getActivePineEditor()?.document.fileName.split(/[/\\]/).pop()

      let connected = false
      let models: string[] = []

      try {
        const agent = PineAgentController.getInstance().getAgent()
        if (agent) {
          connected = await agent.healthCheck()
          if (connected) {
            models = (await agent.getProvider().getModels()).filter(m => !m.includes('embed'))
            if (models.length > 0 && !models.includes(configuredModel)) {
              configuredModel = models.includes('minimax-m3:cloud') ? 'minimax-m3:cloud' : models[0]
            }
          }
        }
      } catch {
        connected = false
        models = []
      }

      this.postMessage({
        type: 'statusUpdate',
        connected,
        host,
        model: configuredModel,
        temperature,
        autoRepair,
        maxIterations,
        models,
        activeFile,
      })
    } catch {
      // Safe fallback
    }
  }

  private postMessage(msg: Record<string, unknown>): void {
    this.view?.webview.postMessage(msg)
  }

  private getNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce()
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'chat-webview.js'))
    const config = vscode.workspace.getConfiguration('pineForge')
    const initialModel = config.get<string>('ollama.model', 'minimax-m3:cloud')
    const initialHost = config.get<string>('ollama.host', 'http://localhost:11434')
    const initialTemp = config.get<number>('ollama.temperature', 0)
    const initialIter = config.get<number>('agent.maxIterations', 12)
    const initialRepair = config.get<boolean>('agent.autoRepair', true)

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource};"><style>
:root{--bg:var(--vscode-sideBar-background,#1e1e1e);--fg:var(--vscode-foreground,#ccc);--card:var(--vscode-editor-background,#252526);--border:var(--vscode-widget-border,#333);--accent:var(--vscode-button-background,#0e639c);--accent-hover:var(--vscode-button-hoverBackground,#1177bb);font-family:var(--vscode-font-family,sans-serif);}
*{box-sizing:border-box;margin:0;padding:0;}body{background:var(--bg);color:var(--fg);font-size:12px;display:flex;flex-direction:column;height:100vh;overflow:hidden;}
button{font-family:inherit;cursor:pointer;}
.header{padding:6px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:6px;}
.model-tag{display:flex;align-items:center;gap:5px;cursor:pointer;padding:2px 6px;border-radius:4px;background:var(--card);border:1px solid var(--border);font-size:11px;user-select:none;}
.dot{width:7px;height:7px;border-radius:50%;background:#e51400;}.dot.online{background:#89d185;}.header-actions{display:flex;gap:4px;}
.settings-drawer{display:none;padding:10px;border-bottom:1px solid var(--border);background:var(--card);flex-direction:column;gap:6px;font-size:11px;}
.settings-drawer.open{display:flex!important;}.cfg-row{display:flex;flex-direction:column;gap:2px;}.cfg-row label{opacity:0.85;font-size:10px;}
.cfg-input{background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:3px;padding:4px 6px;font-size:11px;}
.cfg-actions{display:flex;gap:6px;margin-top:4px;}
.tab-bar{display:flex;border-bottom:1px solid var(--border);background:var(--card);}
.tab-btn{flex:1;padding:6px 4px;background:transparent;border:none;color:var(--fg);cursor:pointer;font-size:11px;opacity:0.7;border-bottom:2px solid transparent;user-select:none;}
.tab-btn.active{opacity:1;font-weight:bold;border-bottom:2px solid var(--accent);}
.quick-bar{display:flex;gap:5px;padding:6px 10px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none;}
.chip{background:var(--card);border:1px solid var(--border);color:var(--fg);padding:3px 8px;border-radius:12px;cursor:pointer;white-space:nowrap;font-size:11px;user-select:none;transition:background 0.15s ease,color 0.15s ease,border-color 0.15s ease;}
.chip:hover{background:var(--accent);color:#fff;border-color:var(--accent);}.chip:active{transform:translateY(1px);}.view-panel{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;}
.msg{padding:7px 9px;border-radius:6px;line-height:1.4;word-break:break-word;}.msg.user{background:var(--accent);color:#fff;align-self:flex-end;max-width:85%;}.msg.bot{background:var(--card);border:1px solid var(--border);align-self:flex-start;max-width:95%;}
.transcript-box{margin-bottom:6px;border:1px solid var(--border);border-radius:4px;background:#181818;font-size:11px;}
.transcript-box summary{padding:4px 8px;cursor:pointer;background:#202020;border-radius:4px;color:#85c2ff;font-size:10px;user-select:none;}
.transcript-steps{padding:6px 8px;display:flex;flex-direction:column;gap:4px;font-family:monospace;font-size:10px;color:#bbb;}.transcript-step{display:flex;gap:6px;}.t-time{opacity:0.6;}.t-state{color:#4ec9b0;font-weight:600;}
.active-stream-header{font-size:10px;color:#dcdcaa;margin-bottom:4px;font-style:italic;display:flex;align-items:center;gap:4px;}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:#dcdcaa;animation:pulse 1s infinite alternate;}@keyframes pulse{0%{opacity:0.3;}100%{opacity:1;}}
.log-stream{font-family:monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;color:#ccc;}
.md-h1{font-size:13px;font-weight:700;margin:8px 0 4px 0;padding-bottom:2px;border-bottom:1px solid var(--border);color:#fff;}
.md-h2{font-size:12px;font-weight:600;margin:6px 0 3px 0;color:#85c2ff;}
.md-h3{font-size:11px;font-weight:600;margin:5px 0 2px 0;color:#4ec9b0;}
.md-hr{border:none;border-top:1px solid var(--border);margin:8px 0;}
.md-quote{border-left:3px solid var(--accent);padding:3px 8px;margin:4px 0;background:rgba(14,99,156,0.1);border-radius:2px;}
.md-ul,.md-ol{margin:3px 0 3px 14px;padding:0;}
.md-li,.md-oli{margin:2px 0;line-height:1.4;}
.inline-code{background:#181818;padding:1px 4px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);border:1px solid #333;font-size:10px;color:#ce9178;}
.table-wrapper{overflow-x:auto;margin:6px 0;border:1px solid var(--border);border-radius:4px;}
.md-table{width:100%;border-collapse:collapse;font-size:11px;}
.md-table th{background:#2d2d2d;padding:4px 8px;text-align:left;border:1px solid var(--border);font-weight:600;color:#ddd;}
.md-table td{padding:4px 8px;border:1px solid var(--border);}
.code-container{margin:6px 0;border:1px solid var(--border);border-radius:4px;background:#181818;overflow:hidden;}
.code-lang-tag{display:inline-block;font-size:9px;font-family:monospace;padding:1px 6px;background:#264f78;color:#fff;border-radius:0 0 3px 0;text-transform:uppercase;font-weight:bold;}
.code-container pre{margin:0;padding:6px 8px;background:transparent;border:none;overflow-x:auto;}
.code-container code{font-family:var(--vscode-editor-font-family,monospace);font-size:11px;line-height:1.4;}
.code-container .code-actions{display:flex;gap:4px;justify-content:flex-end;padding:3px 6px;background:#202020;border-top:1px solid #2a2a2a;}
.md-p-gap{height:6px;}
.btn-sm{font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:#333;color:#fff;cursor:pointer;}.btn-sm:hover{background:var(--accent);}
.btn-primary{background:var(--accent);color:#fff;border:none;border-radius:3px;padding:4px 8px;cursor:pointer;font-weight:600;font-size:11px;}.btn-primary:hover{background:var(--accent-hover);}
.input-area{padding:8px 10px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:5px;}
.context-row{display:flex;align-items:center;justify-content:space-between;font-size:11px;opacity:0.85;}.input-row{display:flex;gap:6px;}
textarea{flex:1;height:48px;resize:none;background:var(--card);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:5px;font-family:inherit;font-size:12px;}
textarea:focus{outline:1px solid var(--accent);}.send-btn{background:var(--accent);color:#fff;border:none;border-radius:4px;padding:0 12px;cursor:pointer;font-weight:bold;}.send-btn:hover{background:var(--accent-hover);}
</style></head><body>
<div class="header">
<div class="model-tag" id="modelTag"><span class="dot online" id="statusDot"></span><span id="modelName">${initialModel}</span></div>
<div class="header-actions"><button class="btn-sm" id="btnSettingsToggle">⚙️ Settings</button><button class="btn-sm" id="btnClearChat">Clear</button></div>
</div>
<div class="settings-drawer" id="settingsDrawer">
<div class="cfg-row"><label>Model</label><select id="cfgModelSelect" class="cfg-input"><option value="${initialModel}" selected>${initialModel}</option></select></div>
<div class="cfg-row"><label>Custom Model Tag</label><input type="text" id="cfgModelCustom" class="cfg-input" value="${initialModel}" placeholder="e.g. minimax-m3:cloud"></div>
<div class="cfg-row"><label>Ollama Host</label><input type="text" id="cfgHost" class="cfg-input" value="${initialHost}" placeholder="http://localhost:11434"></div>
<div class="cfg-row"><label>Temperature</label><input type="number" id="cfgTemp" class="cfg-input" step="0.1" min="0" max="1" value="${initialTemp}"></div>
<div class="cfg-row"><label>Max Iterations</label><input type="number" id="cfgMaxIter" class="cfg-input" min="1" max="30" value="${initialIter}"></div>
<div class="cfg-row"><label><input type="checkbox" id="cfgAutoRepair" ${initialRepair ? 'checked' : ''}> Auto-repair validation failures</label></div>
<div class="cfg-actions"><button class="btn-primary" id="btnSaveSettings">Save & Apply</button><button class="btn-sm" id="btnVSCodeSettings">VS Code Settings</button></div>
</div>
<div class="tab-bar">
<button class="tab-btn active" id="tabChatBtn">💬 Chat</button>
<button class="tab-btn" id="tabLogBtn">📜 Transcript Log</button>
</div>
<div class="quick-bar" id="quickBar">
<button class="chip" data-action="explain">💡 Explain</button>
<button class="chip" data-action="fix">🔧 Fix</button>
<button class="chip" data-action="optimize">⚡ Optimize</button>
<button class="chip" data-action="migrate">🚀 v5→v6</button>
<button class="chip" data-action="validate">✓ Validate</button>
</div>
<div class="view-panel" id="chatFlow">
<div class="msg bot">Hello! I am <strong>PineForge AI</strong>. Ask questions about Pine Script v6 or use the action chips above.</div>
</div>
<div class="view-panel" id="logFlow" style="display:none;">
<div style="display:flex;justify-content:flex-end;margin-bottom:6px;"><button class="btn-sm" id="btnCopyLog">Copy Log</button></div>
<div class="log-stream" id="fullLogStream">PineForge Agent Initialized. Ready for requests.
</div>
</div>
<div class="input-area">
<div class="context-row"><label><input type="checkbox" id="ctxCheck" checked> Include active script</label><span id="activeFileLabel">No active file</span></div>
<div class="input-row"><textarea id="promptInput" placeholder="Ask PineForge AI... (Enter to send, Shift+Enter for newline)"></textarea><button class="send-btn" id="sendBtn">Send</button></div>
</div>
<script nonce="${nonce}" src="${scriptUri}"></script></body></html>`
  }
}
