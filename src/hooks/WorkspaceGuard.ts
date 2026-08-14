/**
 * WorkspaceGuard - Protected paths enforcement for PineForge
 * 
 * Source concept: TradersPost protected-paths.json
 * Purpose: Prevent accidental modifications to critical files
 */

import * as vscode from 'vscode'
import * as path from 'path'

export interface ProtectedPathsConfig {
  /** General protected paths (git, node_modules, etc.) */
  protected: string[]
  
  /** Pine-specific protected paths (docs, reference manifests) */
  pineProtected: string[]
  
  /** Read-only paths (can view but not modify) */
  readOnly: string[]
}

export const DEFAULT_PROTECTED_PATHS: ProtectedPathsConfig = {
  protected: [
    '**/.git/**',
    '**/.gitignore',
    '**/node_modules/**',
    '**/.env*',
    '**/.DS_Store',
    '**/Thumbs.db',
  ],
  pineProtected: [
    '**/pineDocs.json',
    '**/pineReferenceManifest.json',
    '**/Pine_Script_Documentation/**',
    '**/conformance/**',
  ],
  readOnly: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/test/**',
    '**/tests/**',
  ],
}

export enum ProtectionLevel {
  /** File can be freely modified */
  NONE = 'none',
  
  /** File is read-only (can view but not write) */
  READ_ONLY = 'read_only',
  
  /** File requires explicit confirmation for writes */
  CONFIRM = 'confirm',
  
  /** File cannot be modified by agent */
  BLOCKED = 'blocked',
}

export interface ProtectionResult {
  level: ProtectionLevel
  reason?: string
  path?: string
}

export class WorkspaceGuard {
  private config: ProtectedPathsConfig
  private workspaceRoot: string
  
  constructor(
    workspaceRoot: string,
    config: Partial<ProtectedPathsConfig> = {},
  ) {
    this.workspaceRoot = workspaceRoot
    this.config = {
      ...DEFAULT_PROTECTED_PATHS,
      ...config,
    }
  }
  
  /**
   * Check protection level for a file path
   */
  checkProtection(filePath: string): ProtectionResult {
    // Normalize path
    const normalizedPath = path.normalize(filePath)
    const relativePath = path.relative(this.workspaceRoot, normalizedPath)
    
    // Check blocked paths
    if (this.isMatch(relativePath, this.config.protected)) {
      return {
        level: ProtectionLevel.BLOCKED,
        reason: 'Path is in protected list',
        path: relativePath,
      }
    }
    
    // Check Pine-specific protected paths
    if (this.isMatch(relativePath, this.config.pineProtected)) {
      return {
        level: ProtectionLevel.BLOCKED,
        reason: 'Path is a Pine Script reference file (protected)',
        path: relativePath,
      }
    }
    
    // Check read-only paths
    if (this.isMatch(relativePath, this.config.readOnly)) {
      return {
        level: ProtectionLevel.READ_ONLY,
        reason: 'Path is in read-only list',
        path: relativePath,
      }
    }
    
    return { level: ProtectionLevel.NONE }
  }
  
  /**
   * Check if a file can be modified by the agent
   */
  canModify(filePath: string): { allowed: boolean; reason?: string } {
    const result = this.checkProtection(filePath)
    
    switch (result.level) {
      case ProtectionLevel.BLOCKED:
        return {
          allowed: false,
          reason: `Cannot modify protected file: ${result.path}`,
        }
      
      case ProtectionLevel.READ_ONLY:
        return {
          allowed: false,
          reason: `Cannot modify read-only file: ${result.path}`,
        }
      
      case ProtectionLevel.CONFIRM:
        return {
          allowed: true,
          reason: 'Modification requires user confirmation',
        }
      
      default:
        return { allowed: true }
    }
  }
  
  /**
   * Check if a file can be read
   */
  canRead(filePath: string): { allowed: boolean; reason?: string } {
    const result = this.checkProtection(filePath)
    
    // Blocked files cannot be read by agent
    if (result.level === ProtectionLevel.BLOCKED) {
      return {
        allowed: false,
        reason: `Cannot access protected file: ${result.path}`,
      }
    }
    
    return { allowed: true }
  }
  
  /**
   * Validate a batch of file operations
   */
  validateOperations(operations: Array<{
    type: 'read' | 'write' | 'delete' | 'rename'
    path: string
  }>): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    for (const op of operations) {
      let result: ProtectionResult
      
      switch (op.type) {
        case 'read':
          result = this.checkProtection(op.path)
          if (result.level === ProtectionLevel.BLOCKED) {
            errors.push(`Cannot read protected file: ${op.path}`)
          }
          break
        
        case 'write':
        case 'delete':
        case 'rename':
          const canModify = this.canModify(op.path)
          if (!canModify.allowed) {
            errors.push(canModify.reason || `Cannot ${op.type} file: ${op.path}`)
          }
          break
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  }
  
  /**
   * Get all protected paths
   */
  getProtectedPaths(): string[] {
    return [
      ...this.config.protected,
      ...this.config.pineProtected,
    ]
  }
  
  /**
   * Get all read-only paths
   */
  getReadOnlyPaths(): string[] {
    return [...this.config.readOnly]
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProtectedPathsConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    }
  }
  
  /**
   * Load configuration from file
   */
  static async loadFromConfig(
    workspaceRoot: string,
  ): Promise<WorkspaceGuard> {
    const configPath = path.join(workspaceRoot, '.pineforge', 'protected-paths.json')
    
    try {
      const fs = await import('fs/promises')
      const content = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(content) as ProtectedPathsConfig
      
      return new WorkspaceGuard(workspaceRoot, config)
    } catch {
      // Use default config if file doesn't exist
      return new WorkspaceGuard(workspaceRoot)
    }
  }
  
  /**
   * Check if path matches any pattern
   */
  private isMatch(filePath: string, patterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    return patterns.some(pattern => {
      const p = pattern.replace(/\\/g, '/')
      if (p === normalized || normalized.includes(p.replace(/\*/g, ''))) {
        return true
      }
      const regexStr = p
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/(?<!\.)\*/g, '[^/]*')
      const regex = new RegExp(`^${regexStr}$`, process.platform === 'win32' ? 'i' : undefined)
      return regex.test(normalized)
    })
  }
}

/**
 * VS Code integration for WorkspaceGuard
 */
export class WorkspaceGuardVSCode {
  private guard: WorkspaceGuard
  
  constructor(guard: WorkspaceGuard) {
    this.guard = guard
  }
  
  /**
   * Register VS Code event handlers
   */
  register(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = []
    
    // Intercept document saves
    disposables.push(
      vscode.workspace.onWillSaveTextDocument(async (event) => {
        const filePath = event.document.uri.fsPath
        const canModify = this.guard.canModify(filePath)
        
        if (!canModify.allowed) {
          vscode.window.showWarningMessage(canModify.reason)
          // Prevent save
          throw new Error(canModify.reason)
        }
      }),
    )
    
    // Warn on agent file operations
    disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const filePath = event.document.uri.fsPath
        const result = this.guard.checkProtection(filePath)
        
        if (result.level === ProtectionLevel.BLOCKED) {
          vscode.window.showErrorMessage(
            `Attempted modification of protected file: ${filePath}`,
          )
        }
      }),
    )
    
    context.subscriptions.push(...disposables)
    return disposables
  }
  
  /**
   * Show protection status in status bar
   */
  createStatusBarItem(): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    )
    item.command = 'pineforge.showProtectionStatus'
    item.tooltip = 'PineForge: Protected Paths Active'
    item.text = '$(lock) PineForge'
    item.show()
    
    return item
  }
}
