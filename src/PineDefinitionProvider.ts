import * as vscode from 'vscode'
import { findDefinitionOffset } from './PineDefinitionResolver'

/**
 * Same-file "go to definition" for Pine Script — jumps to a function, type,
 * enum, or variable's declaration within the active document. Cross-file/
 * library symbol resolution is out of scope for this version.
 */
export class PineDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][\w.]*/)
    if (!wordRange) {return undefined}

    const word = document.getText(wordRange)
    const simpleName = word.includes('.') ? (word.split('.').pop() ?? word) : word
    if (!simpleName) {return undefined}

    const offset = findDefinitionOffset(document.getText(), simpleName)
    if (offset === undefined) {return undefined}

    return new vscode.Location(document.uri, document.positionAt(offset))
  }
}
