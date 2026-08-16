/**
 * Pine Agent Policy - Rules and constraints for the agent
 */

export interface AgentPolicy {
  pineVersion: number
  maxPatchSize: number
  requireReferenceForNewAPIs: boolean
  validateBeforeApply: boolean
  preserveTradingSemantics: boolean
  preferMinimalPatches: boolean
  autoRepair: boolean
}

export const DEFAULT_POLICY: AgentPolicy = {
  pineVersion: 6,
  maxPatchSize: 500, // lines
  requireReferenceForNewAPIs: true,
  validateBeforeApply: true,
  preserveTradingSemantics: true,
  preferMinimalPatches: true,
  autoRepair: true,
}

export class PineAgentPolicy {
  private policy: AgentPolicy

  constructor(policy: Partial<AgentPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  /**
   * System prompt rules based on policy
   */
  getSystemRules(): string[] {
    const rules: string[] = [
      `Pine v${this.policy.pineVersion} only.`,
      'Never invent APIs.',
    ]

    if (this.policy.requireReferenceForNewAPIs) {
      rules.push('Use PineReference tools before introducing unfamiliar APIs.')
    }

    rules.push('Never assume a function signature.')

    if (this.policy.validateBeforeApply) {
      rules.push('Validate generated code.')
    }

    if (this.policy.preferMinimalPatches) {
      rules.push('Prefer minimal patches.')
    }

    rules.push('Never modify unrelated code.')

    if (this.policy.preserveTradingSemantics) {
      rules.push('Never silently change trading semantics.')
      rules.push('Preserve existing strategy behavior unless requested.')
    }

    if (this.policy.autoRepair) {
      rules.push('If validation fails, repair and revalidate.')
    }

    return rules
  }

  /**
   * Full system prompt
   */
  getSystemPrompt(): string {
    const rules = this.getSystemRules().map((r, i) => `${i + 1}. ${r}`).join('\n')

    return `You are PineForge, a Pine Script v${this.policy.pineVersion} engineering agent.

Rules:
${rules}

Your role is to:
- Understand Pine code
- Retrieve Pine documentation using tools
- Write Pine code
- Modify Pine code with minimal patches
- Explain Pine concepts
- Debug Pine errors
- Validate Pine against the reference
- Generate indicators and strategies
- Refactor Pine code
- Migrate v5 → v6

Code output guidelines:
- When fixing an error or modifying existing code, output ONLY the targeted fixed code snippet in a \`\`\`pine code block. Do NOT reproduce the entire file or //@version headers unless creating a brand new script or specifically asked for the full file.
- When generating a brand new indicator or strategy, start with //@version=6.

Always use the provided tools to retrieve accurate information before making changes.
Never guess function signatures or API behavior.`
  }

  /**
   * Check if patch size is acceptable
   */
  validatePatchSize(lines: number): boolean {
    return lines <= this.policy.maxPatchSize
  }

  /**
   * Update policy
   */
  update(policy: Partial<AgentPolicy>): void {
    this.policy = { ...this.policy, ...policy }
  }

  /**
   * Get current policy
   */
  getPolicy(): AgentPolicy {
    return { ...this.policy }
  }
}
