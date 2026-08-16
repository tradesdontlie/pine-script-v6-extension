import * as vscode from 'vscode'

/**
 * PineCodeActionProvider provides inline Quick Fix options (Lightbulb / Ctrl+.)
 * on diagnostic squiggles in Pine Script files.
 */
export class PineCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ]

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []
    const lineText = document.lineAt(range.start.line).text

    for (const diagnostic of context.diagnostics) {
      // 1. AI Quick Fix Action
      const aiFixAction = new vscode.CodeAction(
        `💡 Fix with PineForge AI: "${this.truncate(diagnostic.message, 50)}"`,
        vscode.CodeActionKind.QuickFix,
      )
      aiFixAction.isPreferred = true
      aiFixAction.diagnostics = [diagnostic]
      aiFixAction.command = {
        command: 'pineforge.fixDiagnostic',
        title: 'Fix with PineForge AI',
        arguments: [diagnostic, document.fileName, lineText, range.start.line + 1],
      }
      actions.push(aiFixAction)

      // 2. AI Explain Action
      const aiExplainAction = new vscode.CodeAction(
        '💡 Explain Error with PineForge AI',
        vscode.CodeActionKind.QuickFix,
      )
      aiExplainAction.diagnostics = [diagnostic]
      aiExplainAction.command = {
        command: 'pineforge.explainDiagnostic',
        title: 'Explain with PineForge AI',
        arguments: [diagnostic, document.fileName, lineText, range.start.line + 1],
      }
      actions.push(aiExplainAction)

      // 3. Instant deterministic Quick Fixes
      const directFix = this.createDirectFix(document, diagnostic, lineText, range.start.line)
      if (directFix) {
        actions.push(directFix)
      }
    }

    return actions
  }

  private createDirectFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    lineText: string,
    lineIndex: number,
  ): vscode.CodeAction | undefined {
    const msg = diagnostic.message.toLowerCase()

    // Semicolon removal fix
    if (msg.includes('semicolon') || lineText.trim().endsWith(';')) {
      const semiIndex = lineText.lastIndexOf(';')
      if (semiIndex >= 0) {
        const action = new vscode.CodeAction('⚡ Remove trailing semicolon', vscode.CodeActionKind.QuickFix)
        action.diagnostics = [diagnostic]
        action.edit = new vscode.WorkspaceEdit()
        action.edit.delete(document.uri, new vscode.Range(lineIndex, semiIndex, lineIndex, semiIndex + 1))
        return action
      }
    }

    // na-in-ternary fix: guard the bare variable with `not na(x) and x`
    if (msg.includes("may be 'na'") && msg.includes('guard with')) {
      const varMatch = diagnostic.message.match(/'(\w+)' may be 'na'/)
      if (varMatch) {
        const varName = varMatch[1]
        const varIndex = lineText.search(new RegExp(`\\b${varName}\\b`))
        if (varIndex >= 0) {
          const action = new vscode.CodeAction(`⚡ Guard with 'not na(${varName})'`, vscode.CodeActionKind.QuickFix)
          action.diagnostics = [diagnostic]
          action.edit = new vscode.WorkspaceEdit()
          action.edit.replace(
            document.uri,
            new vscode.Range(lineIndex, varIndex, lineIndex, varIndex + varName.length),
            `not na(${varName}) and ${varName}`,
          )
          return action
        }
      }
    }

    // Off-by-one fix: array.size(x) -> array.size(x) - 1
    if (msg.includes('off-by-one') || msg.includes('uses size as index')) {
      const sizeMatch = /array\.size\([^)]+\)/.exec(lineText)
      if (sizeMatch) {
        const matchStart = sizeMatch.index
        const matchEnd = matchStart + sizeMatch[0].length
        const action = new vscode.CodeAction('⚡ Use array.size(...) - 1 for last index', vscode.CodeActionKind.QuickFix)
        action.diagnostics = [diagnostic]
        action.edit = new vscode.WorkspaceEdit()
        action.edit.replace(document.uri, new vscode.Range(lineIndex, matchStart, lineIndex, matchEnd), `${sizeMatch[0]} - 1`)
        return action
      }
    }

    return undefined
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str
  }
}
