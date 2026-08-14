/**
 * Pine Agent State Machine
 */

export type AgentState =
  | 'IDLE'
  | 'PLANNING'
  | 'RESEARCHING'
  | 'GENERATING'
  | 'VALIDATING'
  | 'REPAIRING'
  | 'READY_TO_APPLY'
  | 'APPLYING'
  | 'APPLIED'
  | 'ERROR'

export interface AgentTransition {
  from: AgentState
  to: AgentState
  timestamp: number
  reason?: string
}

export class PineAgentState {
  private currentState: AgentState = 'IDLE'
  private transitions: AgentTransition[] = []
  private iterationCount: number = 0
  private maxIterations: number = 12

  constructor(maxIterations: number = 12) {
    this.maxIterations = maxIterations
  }

  get state(): AgentState {
    return this.currentState
  }

  get iterations(): number {
    return this.iterationCount
  }

  canTransition(to: AgentState): boolean {
    const validTransitions: Record<AgentState, AgentState[]> = {
      IDLE: ['PLANNING', 'ERROR'],
      PLANNING: ['RESEARCHING', 'ERROR'],
      RESEARCHING: ['GENERATING', 'ERROR'],
      GENERATING: ['VALIDATING', 'ERROR'],
      VALIDATING: ['REPAIRING', 'READY_TO_APPLY', 'ERROR'],
      REPAIRING: ['GENERATING', 'ERROR'],
      READY_TO_APPLY: ['APPLYING', 'ERROR'],
      APPLYING: ['APPLIED', 'ERROR'],
      APPLIED: ['IDLE', 'ERROR'],
      ERROR: ['IDLE'],
    }

    return validTransitions[this.currentState]?.includes(to) ?? false
  }

  transition(to: AgentState, reason?: string): boolean {
    if (!this.canTransition(to)) {
      console.warn(`Invalid state transition: ${this.currentState} → ${to}`)
      return false
    }

    const transition: AgentTransition = {
      from: this.currentState,
      to,
      timestamp: Date.now(),
      reason,
    }

    this.transitions.push(transition)
    this.currentState = to

    if (to === 'GENERATING') {
      this.iterationCount++
    }

    if (this.iterationCount >= this.maxIterations && to !== 'ERROR') {
      console.warn('Max iterations reached')
      this.transition('ERROR', 'Max iterations exceeded')
      return false
    }

    return true
  }

  reset(): void {
    this.currentState = 'IDLE'
    this.iterationCount = 0
  }

  getHistory(): AgentTransition[] {
    return [...this.transitions]
  }

  isInTerminalState(): boolean {
    return ['APPLIED', 'ERROR'].includes(this.currentState)
  }

  canRetry(): boolean {
    return this.currentState === 'ERROR' && this.iterationCount < this.maxIterations
  }
}
