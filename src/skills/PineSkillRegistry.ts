/**
 * PineSkillRegistry - Discover, load, and compose Pine skills
 * 
 * Source concept: TradersPost skills architecture
 * Purpose: Manage skill lifecycle and selection
 */

import { PineSkill, PineSkillContext, skillMatchesRequest, rankSkillsByRelevance } from './PineSkill'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'

export interface SkillEntry {
  id: string
  name: string
  description: string
  version: string
  path?: string
  loaded: boolean
  skill?: PineSkill
}

export class PineSkillRegistry {
  private skills: Map<string, PineSkill> = new Map()
  private skillEntries: Map<string, SkillEntry> = new Map()
  private knowledgeEngine: PineKnowledgeEngine
  
  constructor(knowledgeEngine: PineKnowledgeEngine) {
    this.knowledgeEngine = knowledgeEngine
  }
  
  /**
   * Register a skill instance
   */
  register(skill: PineSkill): void {
    this.skills.set(skill.definition.id, skill)
    this.skillEntries.set(skill.definition.id, {
      id: skill.definition.id,
      name: skill.definition.name,
      description: skill.definition.description,
      version: skill.definition.version,
      loaded: true,
      skill,
    })
  }
  
  /**
   * Get a skill by ID
   */
  getSkill(id: string): PineSkill | undefined {
    return this.skills.get(id)
  }
  
  /**
   * Get all registered skills
   */
  getAllSkills(): PineSkill[] {
    return Array.from(this.skills.values())
  }
  
  /**
   * Get all skill entries (including unloaded)
   */
  getSkillEntries(): SkillEntry[] {
    return Array.from(this.skillEntries.values())
  }
  
  /**
   * Find skills that match a request
   */
  findMatchingSkills(request: string): PineSkill[] {
    const allSkills = this.getAllSkills()
    return allSkills.filter(skill => skillMatchesRequest(skill, request))
  }
  
  /**
   * Select the best skill for a request
   */
  selectBestSkill(request: string): PineSkill | undefined {
    const matching = this.findMatchingSkills(request)
    if (matching.length === 0) {
      return undefined
    }
    
    const ranked = rankSkillsByRelevance(matching, request)
    return ranked[0]
  }
  
  /**
   * Select multiple skills for a complex request
   */
  selectSkills(request: string, maxCount: number = 3): PineSkill[] {
    const matching = this.findMatchingSkills(request)
    const ranked = rankSkillsByRelevance(matching, request)
    return ranked.slice(0, maxCount)
  }
  
  /**
   * Check if a skill is registered
   */
  hasSkill(id: string): boolean {
    return this.skills.has(id)
  }
  
  /**
   * Unregister a skill
   */
  unregister(id: string): boolean {
    const removed = this.skills.delete(id)
    if (removed) {
      this.skillEntries.delete(id)
    }
    return removed
  }
  
  /**
   * Get skill documentation
   */
  getSkillDocumentation(id: string): string | undefined {
    const skill = this.skills.get(id)
    if (!skill) {
      return undefined
    }
    return skill.getDocumentation()
  }
  
  /**
   * Get all skill documentation
   */
  getAllDocumentation(): string {
    const docs: string[] = []
    for (const skill of this.skills.values()) {
      docs.push(skill.getDocumentation())
    }
    return docs.join('\n\n---\n\n')
  }
  
  /**
   * Execute a skill with context
   */
  async executeSkill(
    skillId: string,
    context: PineSkillContext,
  ): Promise<{ success: boolean; content: string }> {
    const skill = this.skills.get(skillId)
    if (!skill) {
      return {
        success: false,
        content: `Skill not found: ${skillId}`,
      }
    }
    
    try {
      const result = await skill.execute(context)
      return {
        success: result.success,
        content: result.content,
      }
    } catch (error: any) {
      return {
        success: false,
        content: `Skill execution error: ${error.message}`,
      }
    }
  }
  
  /**
   * Execute the best matching skill for a request
   */
  async executeBestMatch(
    request: string,
    context: PineSkillContext,
  ): Promise<{ success: boolean; content: string; skillId?: string }> {
    const skill = this.selectBestSkill(request)
    if (!skill) {
      return {
        success: false,
        content: `No matching skill found for request: ${request}`,
      }
    }
    
    const result = await this.executeSkill(skill.definition.id, context)
    return {
      ...result,
      skillId: skill.definition.id,
    }
  }
  
  /**
   * Get required tools for a set of skills
   */
  getRequiredToolsForSkills(skillIds: string[]): string[] {
    const tools = new Set<string>()
    for (const id of skillIds) {
      const skill = this.skills.get(id)
      if (skill) {
        for (const tool of skill.getRequiredTools()) {
          tools.add(tool)
        }
      }
    }
    return Array.from(tools)
  }
  
  /**
   * Get optional tools for a set of skills
   */
  getOptionalToolsForSkills(skillIds: string[]): string[] {
    const tools = new Set<string>()
    for (const id of skillIds) {
      const skill = this.skills.get(id)
      if (skill) {
        for (const tool of skill.getOptionalTools()) {
          tools.add(tool)
        }
      }
    }
    return Array.from(tools)
  }
}
