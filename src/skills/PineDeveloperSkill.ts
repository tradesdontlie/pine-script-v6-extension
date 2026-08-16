/**
 * PineDeveloperSkill - Core development skill for Pine Script
 * 
 * Source concept: TradersPost pine-developer skill
 * Purpose: Generate and modify Pine Script code following best practices
 */

import { PineSkill, PineSkillDefinition, PineSkillContext, PineSkillResult } from './PineSkill'

/**
 * Key engineering rules from TradersPost pine-developer skill
 */
export const PINE_DEVELOPER_RULES = [
  // Architecture rules
  {
    id: 'PINE-ARCH-001',
    name: 'UDT-First Architecture',
    description: 'When >= 3 related state fields exist, prefer UDT over parallel arrays',
    trigger: 'state management',
    recommendation: 'Use user-defined types (UDT) with array<UDT> instead of parallel arrays',
  },
  
  // Drawing rules
  {
    id: 'PINE-DRAW-001',
    name: 'Historical Drawing Coordinates',
    description: 'Use xloc.bar_time for historical drawings beyond safe limits',
    trigger: 'historical drawing',
    recommendation: 'Store time + bar_index and use xloc.bar_time for line.new, box.new, etc.',
  },
  
  // Loop semantics
  {
    id: 'PINE-LOOP-001',
    name: 'Loop Semantics v6',
    description: 'Follow v6 loop behavior changes',
    trigger: 'for loop',
    recommendation: 'Ensure loop boundaries are properly cached; avoid dynamic recalculation',
  },
  
  // Input organization
  {
    id: 'PINE-INPUT-001',
    name: 'Input Organization',
    description: 'Group related inputs using input.group()',
    trigger: 'input configuration',
    recommendation: 'Organize inputs into logical groups for better UX',
  },
  
  // Calculation caching
  {
    id: 'PINE-CACHE-001',
    name: 'Calculation Caching',
    description: 'Cache repeated calculations',
    trigger: 'repeated calculation',
    recommendation: 'Store ta.sma(), ta.ema(), etc. in variables before reuse',
  },
  
  // request.security consolidation
  {
    id: 'PINE-HTF-001',
    name: 'HTF Request Consolidation',
    description: 'Combine multiple request.security calls into tuples',
    trigger: 'request.security',
    recommendation: 'Use tuple returns to reduce security call overhead',
  },
] as const

export class PineDeveloperSkill extends PineSkill {
  readonly definition: PineSkillDefinition = {
    id: 'pine-developer',
    name: 'Pine Developer',
    description: 'Generate and modify Pine Script code following v6 best practices, UDT-first design, and proper API usage',
    version: '1.0.0',
    triggerPatterns: [
      'create',
      'write',
      'generate',
      'develop',
      'build',
      'implement',
      'code',
      'script',
      'indicator',
      'strategy',
    ],
    requiredTools: [
      'pine_search_docs',
      'pine_reference',
      'pine_validate',
    ],
    optionalTools: [
      'pine_examples',
      'pine_analyze',
      'pine_patch',
    ],
  }
  
  /**
   * Check if developer skill should activate
   */
  override shouldActivate(context: PineSkillContext): boolean {
    const request = context.userRequest.toLowerCase()
    
    // Always activate for code generation requests
    const hasTrigger = this.definition.triggerPatterns.some(pattern =>
      request.includes(pattern.toLowerCase()),
    )
    
    if (hasTrigger) {
      return true
    }
    
    // Also activate if there's code in the context
    if (context.fileContent && context.fileContent.length > 0) {
      return true
    }
    
    return false
  }
  
  /**
   * Execute the developer skill
   */
  async execute(context: PineSkillContext): Promise<PineSkillResult> {
    const request = context.userRequest
    
    // Analyze what type of development task this is
    const taskType = this.identifyTaskType(request)
    
    // Get relevant references
    const references = await this.getRelevantReferences(request)
    
    // Apply engineering rules
    const applicableRules = this.getApplicableRules(request)
    
    // Generate or modify code
    const codeResult = await this.generateCode(taskType, request, context, references, applicableRules)
    
    return {
      success: codeResult.success,
      content: codeResult.content,
      patches: codeResult.patches,
      metadata: {
        taskType,
        applicableRules: applicableRules.map(r => r.id),
        referencesUsed: references.length,
      },
    }
  }
  
  /**
   * Identify the type of development task
   */
  private identifyTaskType(request: string): 'indicator' | 'strategy' | 'library' | 'modification' | 'migration' {
    const lower = request.toLowerCase()
    
    if (lower.includes('strategy')) {
      return 'strategy'
    }
    if (lower.includes('library')) {
      return 'library'
    }
    if (lower.includes('migrate') || lower.includes('convert')) {
      return 'migration'
    }
    if (lower.includes('modify') || lower.includes('update') || lower.includes('fix')) {
      return 'modification'
    }
    
    // Default to indicator
    return 'indicator'
  }
  
  /**
   * Get relevant Pine references for the request
   */
  private async getRelevantReferences(request: string): Promise<string[]> {
    const references: string[] = []
    
    // Extract potential symbols from request
    const symbolPattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g
    let match
    while ((match = symbolPattern.exec(request)) !== null) {
      const symbol = match[1]
      
      // Skip common words
      if (['the', 'a', 'an', 'and', 'or', 'with', 'for', 'to'].includes(symbol.toLowerCase())) {
        continue
      }
      
      // Query knowledge engine
      const ref = this.knowledgeEngine.query(symbol)
      if (ref) {
        references.push(symbol)
      }
    }
    
    return references
  }
  
  /**
   * Get applicable engineering rules for the request
   */
  private getApplicableRules(request: string): Array<(typeof PINE_DEVELOPER_RULES)[number]> {
    const lower = request.toLowerCase()
    return PINE_DEVELOPER_RULES.filter(rule =>
      lower.includes(rule.trigger.toLowerCase()),
    )
  }
  
  /**
   * Generate code based on task type
   */
  private async generateCode(
    taskType: string,
    request: string,
    context: PineSkillContext,
    references: string[],
    rules: Array<(typeof PINE_DEVELOPER_RULES)[number]>,
  ): Promise<{ success: boolean; content: string; patches?: PineSkillResult['patches'] }> {
    
    const guidelines: string[] = []
    
    // Add rule-based guidelines
    for (const rule of rules) {
      guidelines.push(`- ${rule.name}: ${rule.recommendation}`)
    }
    
    // Build response based on task type
    switch (taskType) {
      case 'indicator':
        return this.createIndicator(request, context, guidelines, references)
      
      case 'strategy':
        return this.createStrategy(request, context, guidelines, references)
      
      case 'modification':
        return this.modifyCode(request, context, guidelines, references)
      
      case 'migration':
        return this.migrateCode(request, context, guidelines, references)
      
      default:
        return {
          success: true,
          content: `Development task identified: ${taskType}\n\nGuidelines:\n${guidelines.join('\n')}\n\nReady to proceed with code generation.`,
        }
    }
  }
  
  /**
   * Create a new indicator
   */
  private async createIndicator(
    request: string,
    context: PineSkillContext,
    guidelines: string[],
    references: string[],
  ): Promise<{ success: boolean; content: string; patches?: PineSkillResult['patches'] }> {
    
    return {
      success: true,
      content: `## Indicator Development Plan

**Request:** ${request}

**Engineering Guidelines:**
${guidelines.map(g => g).join('\n')}

**Relevant APIs:** ${references.join(', ') || 'To be determined'}

**Next Steps:**
1. Research required Pine APIs using pine_search_docs
2. Design indicator architecture (UDT-first if complex state)
3. Generate initial code structure
4. Validate with pine_validate
5. Refine based on validation results`,
    }
  }
  
  /**
   * Create a new strategy
   */
  private async createStrategy(
    request: string,
    context: PineSkillContext,
    guidelines: string[],
    references: string[],
  ): Promise<{ success: boolean; content: string; patches?: PineSkillResult['patches'] }> {
    
    return {
      success: true,
      content: `## Strategy Development Plan

**Request:** ${request}

**Engineering Guidelines:**
${guidelines.map(g => g).join('\n')}

**Relevant APIs:** ${references.join(', ') || 'To be determined'}

**Next Steps:**
1. Research required Pine APIs using pine_search_docs
2. Design strategy architecture (entry/exit logic, risk management)
3. Generate initial code structure with strategy() declaration
4. Validate with pine_validate
5. Prepare for backtesting`,
    }
  }
  
  /**
   * Modify existing code
   */
  private async modifyCode(
    request: string,
    context: PineSkillContext,
    guidelines: string[],
    references: string[],
  ): Promise<{ success: boolean; content: string; patches?: PineSkillResult['patches'] }> {
    
    if (!context.fileContent) {
      return {
        success: false,
        content: 'No file content provided for modification. Please open or provide the Pine Script file to modify.',
      }
    }
    
    return {
      success: true,
      content: `## Code Modification Plan

**Request:** ${request}

**Engineering Guidelines:**
${guidelines.map(g => g).join('\n')}

**Relevant APIs:** ${references.join(', ') || 'None'}

**Current File:** ${context.fileName || 'Untitled'}

**Analysis Required:**
1. Parse current code structure
2. Identify sections needing modification
3. Generate minimal patch using pine_patch
4. Validate changes with pine_validate`,
    }
  }
  
  /**
   * Migrate code between versions
   */
  private async migrateCode(
    request: string,
    context: PineSkillContext,
    guidelines: string[],
    references: string[],
  ): Promise<{ success: boolean; content: string; patches?: PineSkillResult['patches'] }> {
    
    return {
      success: true,
      content: `## Code Migration Plan

**Request:** ${request}

**File:** ${context.fileName || 'Untitled'}

**Guidelines:**
${guidelines.map(g => g).join('\n')}

**Relevant APIs:** ${references.join(', ') || 'None'}

**Key Migration Considerations:**
- v6 loop semantics changes
- Deprecated API replacements
- New v6 features availability
- Backward compatibility requirements

**Next Steps:**
1. Scan for deprecated v5 patterns with pine_analyze
2. Map to v6 equivalents using pine_reference
3. Apply surgical patch using pine_patch
4. Validate with pine_validate`,
    }
  }
}
