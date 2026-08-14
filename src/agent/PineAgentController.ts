/**
 * PineAgentController - Connects Agent Runtime, Skills, Tools, and VS Code UI
 */

import * as vscode from 'vscode'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'
import { PineAgent } from './PineAgent'
import { PineAgentOrchestrator } from './PineAgentOrchestrator'
import { PineWorkflowType } from './PineWorkflow'
import { PineSkillRegistry } from '../skills/PineSkillRegistry'
import { PineDeveloperSkill } from '../skills/PineDeveloperSkill'
import { PineDebuggerSkill } from '../skills/PineDebuggerSkill'
import { PineValidateTool } from '../tools/PineValidateTool'
import { PineSearchDocsTool } from '../tools/PineSearchDocsTool'
import { PinePatchTool } from '../tools/PinePatchTool'
import { PineForgeStatusBar, getGlobalStatusBar } from '../hooks/PineForgeStatusBar'
import { Class } from '../PineClass'

import { PineOptimizerSkill } from '../skills/PineOptimizerSkill'
import { PineVisualizerSkill } from '../skills/PineVisualizerSkill'
import { PineChatParticipant } from '../chat/PineChatParticipant'

export class PineAgentController {
  private static instance: PineAgentController | undefined
  private agent!: PineAgent
  private orchestrator!: PineAgentOrchestrator
  private knowledgeEngine!: PineKnowledgeEngine
  private skillRegistry!: PineSkillRegistry
  private statusBar!: PineForgeStatusBar
  private outputChannel = vscode.window.createOutputChannel('PineForge AI Agent')
  private healthTimer?: NodeJS.Timeout

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): PineAgentController {
    return (PineAgentController.instance ??= new PineAgentController())
  }

  getAgent(): PineAgent {
    return this.agent
  }

  initialize(context: vscode.ExtensionContext): void {
    this.knowledgeEngine = new PineKnowledgeEngine(Class.PineDocsManager)
    this.statusBar = getGlobalStatusBar()
    this.initAgent()
    this.initSkills()
    this.registerCommands(context)
    this.startHealthPolling(context)
    PineChatParticipant.getInstance().register(context, this.knowledgeEngine)
    this.statusBar.updateKnowledgeStatus(true, '6')
    this.statusBar.updateAnalyzerStatus(true)
  }

  private initAgent(): void {
    const config = vscode.workspace.getConfiguration('pineForge')
    this.agent = new PineAgent(this.knowledgeEngine, {
      ollamaHost: config.get<string>('ollama.host', 'http://localhost:11434'),
      model: config.get<string>('ollama.model', 'qwen2.5-coder:7b'),
      maxIterations: config.get<number>('agent.maxIterations', 12),
      autoRepair: config.get<boolean>('agent.autoRepair', true),
    })

    this.agent.registerTool(new PineValidateTool(this.knowledgeEngine))
    this.agent.registerTool(new PineSearchDocsTool(this.knowledgeEngine))
    this.agent.registerTool(new PinePatchTool())

    this.orchestrator = new PineAgentOrchestrator(this.agent, this.knowledgeEngine, {
      autoAdvance: true,
      stopOnValidationError: false,
      maxIterationsPerStep: 5,
    })
  }

  private initSkills(): void {
    this.skillRegistry = new PineSkillRegistry(this.knowledgeEngine)
    this.skillRegistry.register(new PineDeveloperSkill(this.knowledgeEngine))
    this.skillRegistry.register(new PineDebuggerSkill(this.knowledgeEngine))
    this.skillRegistry.register(new PineOptimizerSkill(this.knowledgeEngine))
    this.skillRegistry.register(new PineVisualizerSkill(this.knowledgeEngine))
  }

  private startHealthPolling(context: vscode.ExtensionContext): void {
    const check = async () => {
      const connected = await this.agent.healthCheck()
      const model = vscode.workspace.getConfiguration('pineForge').get<string>('ollama.model', 'qwen2.5-coder:7b')
      this.statusBar.updateOllamaStatus(connected, model)
    }

    void check()
    this.healthTimer = setInterval(() => { void check() }, 15000)
    context.subscriptions.push({
      dispose: () => { if (this.healthTimer) {clearInterval(this.healthTimer)} },
    })
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    const commands: Array<[string, () => Promise<void> | void]> = [
      ['pineforge.showStatusDetails', () => this.statusBar.showStatusPanel()],
      ['pineforge.selectModel', () => this.selectModel()],
      ['pineforge.askAgent', () => this.askAgent()],
      ['pineforge.generateCode', () => this.generateCode()],
      ['pineforge.debugCode', () => this.debugCode()],
      ['pineforge.migrateCode', () => this.migrateCode()],
      ['pineforge.validateCode', () => this.validateActiveScript()],
    ]
    for (const [id, handler] of commands) {
      context.subscriptions.push(vscode.commands.registerCommand(id, handler))
    }
  }

  async selectModel(): Promise<void> {
    const models = await this.agent.getClient().getModels()
    if (models.length === 0) {
      const manual = await vscode.window.showInputBox({
        prompt: 'No models discovered from Ollama. Enter model tag manually:',
        placeHolder: 'e.g. qwen2.5-coder:7b, llama3, deepseek-coder',
      })
      if (manual) {await this.applyModel(manual)}
      return
    }
    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: 'Select active Ollama model for PineForge',
    })
    if (selected) {await this.applyModel(selected)}
  }

  private async applyModel(modelName: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('pineForge')
    await config.update('ollama.model', modelName, vscode.ConfigurationTarget.Global)
    this.initAgent()
    this.statusBar.updateOllamaStatus(true, modelName)
    vscode.window.showInformationMessage(`PineForge active model set to: ${modelName}`)
  }

  async askAgent(): Promise<void> {
    const prompt = await vscode.window.showInputBox({
      prompt: 'Ask PineForge AI Agent (Pine Script v6)',
      placeHolder: 'e.g. Add 20/50 EMA cross with ATR-based stop loss',
    })
    if (!prompt) {return}

    await this.runWithProgress('Processing Request...', async () => {
      const editor = vscode.window.activeTextEditor
      const context = {
        fileContent: editor?.document.getText(),
        fileName: editor?.document.fileName,
        selection: editor?.document.getText(editor.selection),
      }
      this.outputChannel.show(true)
      this.outputChannel.appendLine(`\n=== User Request: ${prompt} ===`)
      const result = await this.agent.run(prompt, context, (prog) => {
        this.outputChannel.appendLine(`[${prog.state}] ${prog.message}`)
      })
      this.outputChannel.appendLine(`\n=== Agent Response ===\n${result.response}`)
      const msg = result.success ? 'Task completed. View output for details.' : `Finished with state: ${result.state}`
      vscode.window.showInformationMessage(`PineForge: ${msg}`)
    })
  }

  async generateCode(): Promise<void> {
    const choice = await vscode.window.showQuickPick([
      { label: 'Indicator', description: 'Create a new technical indicator', value: 'create_indicator' },
      { label: 'Strategy', description: 'Create a backtestable strategy', value: 'create_strategy' },
      { label: 'Feature / Component', description: 'Develop code for active script', value: 'develop' },
    ], { placeHolder: 'Select code generation type' })
    if (!choice) {return}

    const requirement = await vscode.window.showInputBox({
      prompt: `Describe your ${choice.label.toLowerCase()} requirements:`,
      placeHolder: 'e.g. Multi-timeframe RSI divergence with dashboard',
    })
    if (!requirement) {return}

    await this.runWithProgress(`Generating ${choice.label}...`, async () => {
      const editor = vscode.window.activeTextEditor
      this.outputChannel.show(true)
      this.outputChannel.appendLine(`\n=== Starting Workflow: ${choice.value} ===`)

      const result = await this.orchestrator.startWorkflow(
        choice.value as PineWorkflowType,
        requirement,
        { fileContent: editor?.document.getText(), fileName: editor?.document.fileName },
        (p) => {
          this.statusBar.updateAgentState('generating', p.workflowType, p.currentStep)
          this.outputChannel.appendLine(`[${p.currentStep}]: ${p.message}`)
        },
      )
      this.statusBar.updateAgentState('idle')
      this.outputChannel.appendLine(`=== Workflow Result: ${result.success ? 'Success' : 'Failed'} ===`)
      if (result.errors?.length) {this.outputChannel.appendLine(`Errors:\n${result.errors.join('\n')}`)}
    })
  }

  async debugCode(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor || editor.document.languageId !== 'pine') {
      vscode.window.showWarningMessage('Please open an active Pine Script file to debug.')
      return
    }

    await this.runWithProgress('Diagnosing Pine Script...', async () => {
      const result = await this.skillRegistry.executeSkill('pine-debugger', {
        userRequest: 'Diagnose repainting, runtime NA errors, and performance issues',
        fileContent: editor.document.getText(),
        fileName: editor.document.fileName,
        knowledgeEngine: this.knowledgeEngine,
      })
      this.outputChannel.show(true)
      this.outputChannel.appendLine(`\n=== PineForge Debug Report ===\n${result.content}`)
      vscode.window.showInformationMessage('Pine Script diagnosis complete. Review Output Channel.')
    })
  }

  async migrateCode(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor || editor.document.languageId !== 'pine') {
      vscode.window.showWarningMessage('Please open a Pine Script file to migrate.')
      return
    }

    await this.runWithProgress('Migrating to Pine Script v6...', async () => {
      this.outputChannel.show(true)
      this.outputChannel.appendLine('\n=== Starting Migration: v5 -> v6 ===')
      const result = await this.orchestrator.startWorkflow(
        'migrate_v5_v6',
        'Migrate active Pine script to Pine v6 standard',
        { fileContent: editor.document.getText(), fileName: editor.document.fileName },
        (p) => { this.outputChannel.appendLine(`[${p.currentStep}] ${p.message}`) },
      )
      this.outputChannel.appendLine(`=== Migration ${result.success ? 'Complete' : 'Failed'} ===`)
      if (result.errors?.length) {this.outputChannel.appendLine(`Errors:\n${result.errors.join('\n')}`)}
    })
  }

  async validateActiveScript(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor open.')
      return
    }

    const validateTool = new PineValidateTool(this.knowledgeEngine)
    const result = await validateTool.execute({ code: editor.document.getText(), mode: 'full' })
    this.outputChannel.show(true)
    this.outputChannel.appendLine(`\n${result.content}`)

    if (result.success) {
      vscode.window.showInformationMessage('Pine Script validation: PASSED (0 errors)')
    } else {
      vscode.window.showErrorMessage('Pine Script validation: FAILED. Check Output Channel for diagnostics.')
    }
  }

  private async runWithProgress(title: string, task: () => Promise<void>): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false,
    }, task)
  }
}
