/**
 * PineSkill - Base interface for PineForge skills
 * 
 * Source concept: TradersPost skills architecture
 * Purpose: Modular capabilities instead of monolithic system prompt
 */

import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'

export interface PineSkillDefinition {
  /** Unique skill identifier */
  id: string
  
  /** Human-readable name */
  name: string
  
  /** Skill description for selection */
  description: string
  
  /** Version of the skill definition */
  version: string
  
  /** When this skill should be activated */
  triggerPatterns: string[]
  
  /** Tools this skill requires */
  requiredTools: string[]
  
  /** Optional tools this skill can use */
  optionalTools: string[]
}

export interface PineSkillContext {
  /** Current file content */
  fileContent?: string
  
  /** Current file name */
  fileName?: string
  
  /** Selected text if any */
  selection?: string
  
  /** Current diagnostics */
  diagnostics?: string
  
  /** User request */
  userRequest: string
  
  /** Knowledge engine for reference lookups */
  knowledgeEngine: PineKnowledgeEngine
}

export interface PineSkillResult {
  /** Whether the skill execution was successful */
  success: boolean
  
  /** Result content or message */
  content: string
  
  /** Generated code patches if any */
  patches?: Array<{
    filePath: string
    originalCode: string
    patchedCode: string
  }>
  
  /** Diagnostic information */
  diagnostics?: Array<{
    line: number
    column: number
    severity: 'error' | 'warning' | 'info'
    message: string
  }>
  
  /** Metadata for downstream skills */
  metadata?: Record<string, unknown>
}

/**
 * Abstract base class for all Pine Skills
 */
export abstract class PineSkill {
  /** Skill definition metadata */
  abstract readonly definition: PineSkillDefinition
  
  /** Reference to knowledge engine */
  protected knowledgeEngine: PineKnowledgeEngine
  
  constructor(knowledgeEngine: PineKnowledgeEngine) {
    this.knowledgeEngine = knowledgeEngine
  }
  
  /**
   * Check if this skill should handle the given request
   */
  shouldActivate(context: PineSkillContext): boolean {
    const request = context.userRequest.toLowerCase()
    return this.definition.triggerPatterns.some(pattern => 
      request.includes(pattern.toLowerCase()),
    )
  }
  
  /**
   * Execute the skill with the given context
   */
  abstract execute(context: PineSkillContext): Promise<PineSkillResult>
  
  /**
   * Get tools required by this skill
   */
  getRequiredTools(): string[] {
    return [...this.definition.requiredTools]
  }
  
  /**
   * Get tools optionally used by this skill
   */
  getOptionalTools(): string[] {
    return [...this.definition.optionalTools]
  }
  
  /**
   * Get skill documentation
   */
  getDocumentation(): string {
    return `## ${this.definition.name}\n\n${this.definition.description}\n\nVersion: ${this.definition.version}`
  }
}

/**
 * Helper function to check if a skill matches a request
 */
export function skillMatchesRequest(
  skill: PineSkill,
  request: string,
): boolean {
  const requestLower = request.toLowerCase()
  return skill.definition.triggerPatterns.some(pattern =>
    requestLower.includes(pattern.toLowerCase()),
  )
}

/**
 * Helper function to rank skills by relevance
 */
export function rankSkillsByRelevance(
  skills: PineSkill[],
  request: string,
): PineSkill[] {
  const requestLower = request.toLowerCase()
  
  return skills.sort((a, b) => {
    const aScore = a.definition.triggerPatterns.filter(p => 
      requestLower.includes(p.toLowerCase()),
    ).length
    
    const bScore = b.definition.triggerPatterns.filter(p => 
      requestLower.includes(p.toLowerCase()),
    ).length
    
    return bScore - aScore
  })
}
