/**
 * PineForgeStatusBar - Status panel for PineForge agent
 * 
 * Source concept: TradersPost statusline.sh
 * Purpose: Show real-time agent state, connection status, and capabilities
 */

import * as vscode from 'vscode'

export interface PineForgeStatus {
  // Ollama connection
  ollamaConnected: boolean
  ollamaModel?: string
  
  // Knowledge engine
  pineDocsLoaded: boolean
  referenceVersion?: string
  
  // Analyzer
  analyzerReady: boolean
  
  // Agent state
  agentState: 'idle' | 'planning' | 'researching' | 'generating' | 'validating' | 'repairing' | 'applying' | 'error'
  currentWorkflow?: string
  currentStep?: string
  
  // TradingView connection (future)
  tradingViewReachable?: boolean
  
  // Chart connection (future)
  chartConnected?: boolean
}

export const DEFAULT_STATUS: PineForgeStatus = {
  ollamaConnected: false,
  pineDocsLoaded: false,
  analyzerReady: false,
  agentState: 'idle',
}

export class PineForgeStatusBar {
  private statusBarItem: vscode.StatusBarItem
  private status: PineForgeStatus = DEFAULT_STATUS
  private tooltipLines: string[] = []
  
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    )
    this.statusBarItem.command = 'pineforge.showStatusDetails'
    this.updateDisplay()
  }
  
  /**
   * Update the entire status
   */
  updateStatus(status: Partial<PineForgeStatus>): void {
    this.status = { ...this.status, ...status }
    this.updateDisplay()
  }
  
  /**
   * Update Ollama connection status
   */
  updateOllamaStatus(connected: boolean, model?: string): void {
    this.status.ollamaConnected = connected
    this.status.ollamaModel = model
    this.updateDisplay()
  }
  
  /**
   * Update knowledge engine status
   */
  updateKnowledgeStatus(docsLoaded: boolean, version?: string): void {
    this.status.pineDocsLoaded = docsLoaded
    this.status.referenceVersion = version
    this.updateDisplay()
  }
  
  /**
   * Update analyzer status
   */
  updateAnalyzerStatus(ready: boolean): void {
    this.status.analyzerReady = ready
    this.updateDisplay()
  }
  
  /**
   * Update agent state
   */
  updateAgentState(
    state: PineForgeStatus['agentState'],
    workflow?: string,
    step?: string,
  ): void {
    this.status.agentState = state
    this.status.currentWorkflow = workflow
    this.status.currentStep = step
    this.updateDisplay()
  }
  
  /**
   * Update TradingView connection status
   */
  updateTradingViewStatus(reachable: boolean): void {
    this.status.tradingViewReachable = reachable
    this.updateDisplay()
  }
  
  /**
   * Update chart connection status
   */
  updateChartStatus(connected: boolean): void {
    this.status.chartConnected = connected
    this.updateDisplay()
  }
  
  /**
   * Show busy indicator during operations
   */
  showBusy(message: string): void {
    this.statusBarItem.text = '$(sync~spin) PineForge'
    this.statusBarItem.tooltip = `PineForge: ${message}`
  }
  
  /**
   * Show error state
   */
  showError(message: string): void {
    this.statusBarItem.text = '$(error) PineForge'
    this.statusBarItem.tooltip = `PineForge Error: ${message}`
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
  }
  
  /**
   * Clear error state
   */
  clearError(): void {
    this.statusBarItem.backgroundColor = undefined
    this.updateDisplay()
  }
  
  /**
   * Get current status details
   */
  getStatusDetails(): string {
    const lines: string[] = [
      '## PineForge Status\n',
      '### Connection',
      `Ollama: ${this.status.ollamaConnected ? '● Connected' : '○ Disconnected'}${this.status.ollamaModel ? ` (${this.status.ollamaModel})` : ''}`,
      '',
      '### Knowledge',
      `Pine Docs: ${this.status.pineDocsLoaded ? '✓ Loaded' : '✗ Not loaded'}${this.status.referenceVersion ? ` (v${this.status.referenceVersion})` : ''}`,
      '',
      '### Analysis',
      `Analyzer: ${this.status.analyzerReady ? '✓ Ready' : '✗ Not ready'}`,
      '',
      '### Agent',
      `State: ${this.formatAgentState(this.status.agentState)}`,
      this.status.currentWorkflow ? `Workflow: ${this.status.currentWorkflow}` : '',
      this.status.currentStep ? `Step: ${this.status.currentStep}` : '',
      '',
      '### External',
      `TradingView: ${this.status.tradingViewReachable === true ? '✓ Reachable' : this.status.tradingViewReachable === false ? '✗ Unreachable' : '? Unknown'}`,
      `Chart: ${this.status.chartConnected === true ? '✓ Connected' : this.status.chartConnected === false ? '✗ Disconnected' : '? Unknown'}`,
    ]
    
    return lines.filter(l => l !== '').join('\n')
  }
  
  /**
   * Show status details in a webview panel
   */
  showStatusPanel(): void {
    const panel = vscode.window.createWebviewPanel(
      'pineforgeStatus',
      'PineForge Status',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    )
    
    const details = this.getStatusDetails()
    panel.webview.html = this.getHtmlContent(details)
  }
  
  /**
   * Generate HTML for status panel
   */
  private getHtmlContent(details: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PineForge Status</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-background);
    }
    h1 {
      color: var(--vscode-editor-foreground);
      border-bottom: 1px solid var(--vscode-widget-border);
      padding-bottom: 10px;
    }
    h2 {
      color: var(--vscode-sideBarSectionHeader-foreground);
      font-size: 1.2em;
      margin-top: 20px;
    }
    .status-item {
      margin: 8px 0;
      padding: 8px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
    }
    .status-connected {
      color: var(--vscode-terminal-ansiGreen);
    }
    .status-disconnected {
      color: var(--vscode-terminal-ansiRed);
    }
    .status-warning {
      color: var(--vscode-terminal-ansiYellow);
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <h1>PineForge Status Panel</h1>
  <pre>${this.escapeHtml(details)}</pre>
  <p><em>Last updated: ${new Date().toLocaleTimeString()}</em></p>
</body>
</html>`
  }
  
  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
  
  /**
   * Format agent state for display
   */
  private formatAgentState(state: PineForgeStatus['agentState']): string {
    const icons: Record<PineForgeStatus['agentState'], string> = {
      idle: '○ Idle',
      planning: '⟳ Planning...',
      researching: '⟳ Researching...',
      generating: '⟳ Generating...',
      validating: '⟳ Validating...',
      repairing: '⟳ Repairing...',
      applying: '⟳ Applying...',
      error: '✗ Error',
    }
    
    return icons[state] || state
  }
  
  /**
   * Update the status bar display
   */
  private updateDisplay(): void {
    // Build status text
    const indicators: string[] = []
    
    if (!this.status.ollamaConnected) {
      indicators.push('$(alert)')
    }
    
    if (!this.status.pineDocsLoaded) {
      indicators.push('$(book)')
    }
    
    switch (this.status.agentState) {
      case 'error':
        indicators.push('$(error)')
        break
      case 'idle':
        indicators.push('$(check)')
        break
      default:
        indicators.push('$(sync~spin)')
    }
    
    this.statusBarItem.text = indicators.join(' ') + ' PineForge'
    
    // Build tooltip
    this.statusBarItem.tooltip = this.getStatusDetails()
    
    // Set background based on state
    if (this.status.agentState === 'error') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
    } else if (!this.status.ollamaConnected) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
    } else {
      this.statusBarItem.backgroundColor = undefined
    }
    
    this.statusBarItem.show()
  }
  
  /**
   * Dispose of the status bar
   */
  dispose(): void {
    this.statusBarItem.dispose()
  }
}

/**
 * Global status bar instance
 */
let globalStatusBar: PineForgeStatusBar | undefined

/**
 * Get or create the global status bar
 */
export function getGlobalStatusBar(): PineForgeStatusBar {
  if (!globalStatusBar) {
    globalStatusBar = new PineForgeStatusBar()
  }
  return globalStatusBar
}

/**
 * Dispose of the global status bar
 */
export function disposeGlobalStatusBar(): void {
  if (globalStatusBar) {
    globalStatusBar.dispose()
    globalStatusBar = undefined
  }
}
