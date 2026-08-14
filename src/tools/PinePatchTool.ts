/**
 * PinePatchTool - Apply unified diff patches to Pine Script files
 * 
 * Purpose: Safe, minimal code modifications with validation
 */

import { PineTool, PineToolDefinition, PineToolResult } from './PineTool'
import * as vscode from 'vscode'
import { WorkspaceGuard } from '../hooks/WorkspaceGuard'

export interface PatchOperation {
  /** Path to the file to patch */
  filePath: string
  
  /** Original code (for verification) */
  originalCode?: string
  
  /** New/replacement code */
  patchedCode: string
  
  /** Optional: line range for targeted replacement */
  range?: {
    startLine: number
    endLine: number
  }
}

export interface PatchResult {
  success: boolean
  filePath: string
  appliedLines?: { start: number; end: number }
  rejectedReason?: string
  diff?: string
}

export class PinePatchTool extends PineTool {
  readonly definition: PineToolDefinition = {
    name: 'pine_patch',
    description: 'Apply a minimal patch to Pine Script code. Supports full file replacement or targeted line-range edits. Always validates the target file is not protected before applying.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the Pine Script file to patch',
        },
        originalCode: {
          type: 'string',
          description: 'Original code segment being replaced (for verification)',
        },
        patchedCode: {
          type: 'string',
          description: 'New code to apply',
        },
        startLine: {
          type: 'number',
          description: 'Starting line number for targeted replacement (1-indexed)',
        },
        endLine: {
          type: 'number',
          description: 'Ending line number for targeted replacement (1-indexed)',
        },
        showDiff: {
          type: 'boolean',
          description: 'Whether to show the diff preview before applying',
        },
      },
      required: ['filePath', 'patchedCode'],
    },
  }

  private workspaceGuard?: WorkspaceGuard

  setWorkspaceGuard(guard: WorkspaceGuard): void {
    this.workspaceGuard = guard
  }

  async execute(args: Record<string, unknown>): Promise<PineToolResult> {
    const filePath = args.filePath as string
    const originalCode = args.originalCode as string | undefined
    const patchedCode = args.patchedCode as string
    const startLine = args.startLine as number | undefined
    const endLine = args.endLine as number | undefined
    const showDiff = args.showDiff as boolean | undefined

    if (!filePath || typeof filePath !== 'string') {
      return {
        success: false,
        content: 'Error: filePath is required and must be a string',
      }
    }

    if (!patchedCode || typeof patchedCode !== 'string') {
      return {
        success: false,
        content: 'Error: patchedCode is required and must be a string',
      }
    }

    try {
      // Check protection status
      if (this.workspaceGuard) {
        const canModify = this.workspaceGuard.canModify(filePath)
        if (!canModify.allowed) {
          return {
            success: false,
            content: `Cannot patch protected file: ${canModify.reason}`,
            requiresConfirmation: false,
          }
        }
      }

      // Get current document
      const document = await this.getDocument(filePath)
      if (!document) {
        return {
          success: false,
          content: `File not found: ${filePath}`,
        }
      }

      // Verify original code if provided
      if (originalCode) {
        const docContent = document.getText()
        if (!docContent.includes(originalCode)) {
          return {
            success: false,
            content: 'Verification failed: Original code not found in file. The file may have been modified since the patch was generated.',
            requiresConfirmation: false,
          }
        }
      }

      // Build the edit
      const edit = new vscode.WorkspaceEdit()
      
      if (startLine !== undefined && endLine !== undefined) {
        // Targeted line range replacement
        const startPos = new vscode.Position(startLine - 1, 0)
        const endPos = new vscode.Position(endLine, 0)
        const range = new vscode.Range(startPos, endPos)
        
        edit.replace(document.uri, range, patchedCode)
      } else {
        // Full file replacement
        const fullRange = document.validateRange(
          new vscode.Range(0, 0, document.lineCount, 0),
        )
        edit.replace(document.uri, fullRange, patchedCode)
      }

      // Show diff preview if requested
      if (showDiff) {
        const diffPreview = await this.generateDiffPreview(document, patchedCode, startLine, endLine)
        return {
          success: true,
          content: `Patch Preview:\n\n${diffPreview}\n\nTo apply this patch, call pine_patch again without showDiff or with showDiff=false`,
          requiresConfirmation: true,
          metadata: { preview: true },
        }
      }

      // Apply the edit
      const applied = await vscode.workspace.applyEdit(edit)
      
      if (!applied) {
        return {
          success: false,
          content: 'Failed to apply patch. The workspace edit was rejected.',
        }
      }

      // Save the document
      await document.save()

      return {
        success: true,
        content: `Successfully applied patch to ${filePath}`,
        metadata: {
          filePath,
          linesModified: endLine ? endLine - (startLine ?? 1) : document.lineCount,
        },
      }

    } catch (error: any) {
      return {
        success: false,
        content: `Patch error: ${error.message}`,
      }
    }
  }

  /**
   * Get document from file path
   */
  private async getDocument(filePath: string): Promise<vscode.TextDocument | null> {
    // Try to find open document first
    const openDoc = vscode.workspace.textDocuments.find(
      doc => doc.uri.fsPath === filePath || doc.uri.toString() === filePath,
    )
    
    if (openDoc) {
      return openDoc
    }

    // Try to open the file
    try {
      const uri = vscode.Uri.file(filePath)
      return await vscode.workspace.openTextDocument(uri)
    } catch {
      return null
    }
  }

  /**
   * Generate diff preview
   */
  private async generateDiffPreview(
    document: vscode.TextDocument,
    patchedCode: string,
    startLine?: number,
    endLine?: number,
  ): Promise<string> {
    const originalContent = document.getText()
    const lines = originalContent.split('\n')
    
    let originalSegment: string
    if (startLine !== undefined && endLine !== undefined) {
      originalSegment = lines.slice(startLine - 1, endLine).join('\n')
    } else {
      originalSegment = originalContent
    }

    // Simple unified diff format
    const diffLines: string[] = []
    diffLines.push('--- Original')
    diffLines.push('+++ Patched')
    diffLines.push('')
    
    const originalLines = originalSegment.split('\n')
    const patchedLines = patchedCode.split('\n')
    
    // Show removed lines
    for (const line of originalLines) {
      diffLines.push(`- ${line}`)
    }
    
    // Show added lines
    for (const line of patchedLines) {
      diffLines.push(`+ ${line}`)
    }
    
    return diffLines.join('\n')
  }

  /**
   * Generate a unified diff between two strings
   */
  static generateUnifiedDiff(original: string, patched: string, originalLabel = 'original', patchedLabel = 'patched'): string {
    const originalLines = original.split('\n')
    const patchedLines = patched.split('\n')
    
    const diffLines: string[] = []
    diffLines.push(`--- ${originalLabel}`)
    diffLines.push(`+++ ${patchedLabel}`)
    diffLines.push('')
    
    // Simple line-by-line diff
    const maxLen = Math.max(originalLines.length, patchedLines.length)
    
    for (let i = 0; i < maxLen; i++) {
      const origLine = originalLines[i]
      const patchLine = patchedLines[i]
      
      if (origLine === undefined) {
        diffLines.push(`+ ${patchLine}`)
      } else if (patchLine === undefined) {
        diffLines.push(`- ${origLine}`)
      } else if (origLine !== patchLine) {
        diffLines.push(`- ${origLine}`)
        diffLines.push(`+ ${patchLine}`)
      } else {
        diffLines.push(`  ${origLine}`)
      }
    }
    
    return diffLines.join('\n')
  }
}
