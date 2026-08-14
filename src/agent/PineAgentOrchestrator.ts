/**
 * PineAgentOrchestrator - Multi-stage workflow coordinator for PineForge
 * 
 * Source concept: TradersPost pine-manager skill
 * Purpose: Coordinate multi-stage workflows instead of single ReAct loop
 */

import { PineAgent } from './PineAgent'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'
import {
  PineWorkflow,
  PineWorkflowType,
  WorkflowStep,
  getWorkflow,
  getFirstStep,
  getNextStep,
  isWorkflowComplete,
} from './PineWorkflow'

export interface OrchestratorConfig {
  autoAdvance?: boolean
  stopOnValidationError?: boolean
  maxIterationsPerStep?: number
}

export interface WorkflowProgress {
  workflowType: PineWorkflowType
  currentStep: WorkflowStep
  totalSteps: number
  completedSteps: number
  message: string
  result?: string
}

export interface WorkflowResult {
  success: boolean
  workflowType: PineWorkflowType
  completedSteps: WorkflowStep[]
  finalResult: string
  errors: string[]
}

export class PineAgentOrchestrator {
  private agent: PineAgent
  private knowledgeEngine: PineKnowledgeEngine
  private config: OrchestratorConfig
  private currentWorkflow: PineWorkflow | null = null
  private currentStep: WorkflowStep | null = null
  private completedSteps: WorkflowStep[] = []
  private stepResults: Map<WorkflowStep, string> = new Map()

  constructor(
    agent: PineAgent,
    knowledgeEngine: PineKnowledgeEngine,
    config: OrchestratorConfig = {},
  ) {
    this.agent = agent
    this.knowledgeEngine = knowledgeEngine
    this.config = {
      autoAdvance: config.autoAdvance ?? true,
      stopOnValidationError: config.stopOnValidationError ?? true,
      maxIterationsPerStep: config.maxIterationsPerStep ?? 3,
    }
  }

  /**
   * Start a workflow
   */
  async startWorkflow(
    workflowType: PineWorkflowType,
    userRequest: string,
    context: {
      fileContent?: string
      fileName?: string
      selection?: string
      diagnostics?: string
    },
    onProgress?: (progress: WorkflowProgress) => void,
  ): Promise<WorkflowResult> {
    const workflow = getWorkflow(workflowType)
    if (!workflow) {
      return {
        success: false,
        workflowType,
        completedSteps: [],
        finalResult: `Unknown workflow: ${workflowType}`,
        errors: [`Workflow "${workflowType}" not found`],
      }
    }

    this.currentWorkflow = workflow
    this.currentStep = getFirstStep(workflowType) ?? null
    this.completedSteps = []
    this.stepResults = new Map()

    onProgress?.({
      workflowType,
      currentStep: this.currentStep!,
      totalSteps: workflow.steps.length,
      completedSteps: 0,
      message: `Starting ${workflowType} workflow`,
    })

    // Execute workflow steps
    while (this.currentStep && this.currentWorkflow) {
      try {
        const stepResult = await this.executeStep(
          this.currentStep,
          userRequest,
          context,
          onProgress,
        )

        if (!stepResult.success) {
          // Handle step failure
          if (this.config.stopOnValidationError && stepResult.error?.includes('validation')) {
            return {
              success: false,
              workflowType,
              completedSteps: [...this.completedSteps],
              finalResult: `Workflow stopped at step "${this.currentStep}": ${stepResult.error}`,
              errors: [stepResult.error || 'Unknown error'],
            }
          }

          // Log warning but continue
          console.warn(`Step "${this.currentStep}" had issues: ${stepResult.error}`)
        }

        // Record step completion
        this.completedSteps.push(this.currentStep)
        if (stepResult.result) {
          this.stepResults.set(this.currentStep, stepResult.result)
        }

        // Check if workflow is complete
        if (isWorkflowComplete(workflowType, this.currentStep)) {
          return {
            success: true,
            workflowType,
            completedSteps: [...this.completedSteps],
            finalResult: stepResult.result || 'Workflow completed successfully',
            errors: [],
          }
        }

        // Advance to next step
        this.currentStep = getNextStep(workflowType, this.currentStep) ?? null

        if (!this.currentStep) {
          break
        }

        onProgress?.({
          workflowType,
          currentStep: this.currentStep,
          totalSteps: workflow.steps.length,
          completedSteps: this.completedSteps.length,
          message: `Moving to step: ${this.currentStep}`,
        })

      } catch (error: any) {
        return {
          success: false,
          workflowType,
          completedSteps: [...this.completedSteps],
          finalResult: `Workflow failed: ${error.message}`,
          errors: [error.message],
        }
      }
    }

    return {
      success: true,
      workflowType,
      completedSteps: [...this.completedSteps],
      finalResult: 'Workflow completed',
      errors: [],
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    userRequest: string,
    context: {
      fileContent?: string
      fileName?: string
      selection?: string
      diagnostics?: string
    },
    onProgress?: (progress: WorkflowProgress) => void,
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    if (!this.currentWorkflow) {
      return { success: false, error: 'No active workflow' }
    }

    onProgress?.({
      workflowType: this.currentWorkflow.type,
      currentStep: step,
      totalSteps: this.currentWorkflow.steps.length,
      completedSteps: this.completedSteps.length,
      message: `Executing step: ${step}`,
    })

    // Build step-specific prompt
    const stepPrompt = this.buildStepPrompt(step, userRequest, context)

    // Execute agent for this step
    let iteration = 0
    let lastError: string | undefined

    while (iteration < this.config.maxIterationsPerStep!) {
      const currentIteration = iteration + 1
      try {
        const result = await this.agent.run(stepPrompt, context, (progress) => {
          onProgress?.({
            workflowType: this.currentWorkflow!.type,
            currentStep: step,
            totalSteps: this.currentWorkflow!.steps.length,
            completedSteps: this.completedSteps.length,
            message: `${progress.message} (iteration ${currentIteration})`,
          })
        })

        if (result.success) {
          return { success: true, result: result.response }
        }

        lastError = result.response
        iteration++
      } catch (error: any) {
        lastError = error.message
        iteration++
      }
    }

    return {
      success: false,
      error: lastError || `Step "${step}" failed after ${iteration} iterations`,
    }
  }

  /**
   * Build prompt for a specific step
   */
  private buildStepPrompt(
    step: WorkflowStep,
    userRequest: string,
    context: {
      fileContent?: string
      fileName?: string
      selection?: string
      diagnostics?: string
    },
  ): string {
    const stepInstructions: Record<WorkflowStep, string> = {
      research: `Research the requirements and find relevant Pine Script references. Use pine_search_docs and pine_reference tools to gather information about the APIs needed for: ${userRequest}`,

      design: `Design the architecture for the Pine Script. Consider UDT-first design, input organization, and overall structure. Create a design plan based on: ${userRequest}`,

      visualize: `Plan how to visualize the indicator/strategy output. Identify key plot points, drawings, and visual elements needed for: ${userRequest}`,

      develop: `Write the Pine Script code based on the research and design. Follow Pine v6 best practices, use minimal patches, and ensure code quality for: ${userRequest}`,

      validate: 'Validate the generated Pine Script code using pine_validate. Check for syntax errors, type issues, static analysis problems, and reference conformance. Report all findings.',

      debug: 'Debug any issues found during validation or reported by the user. Use pine_debug and pine_analyze tools to diagnose problems and generate fixes.',

      optimize: 'Optimize the Pine Script code for performance. Look for calculation caching opportunities, request.security consolidation, loop optimizations, and code structure improvements.',

      backtest: 'Run backtest analysis on the strategy. Collect metrics and analyze performance. Note: Pine-native metrics are baseline only; external research engine provides quant-grade analysis.',

      inspect: 'Inspect the code for issues. Use pine_analyze to identify problems, review diagnostics, and understand the current state of the code.',

      reference_lookup: 'Look up specific Pine Script references for symbols and APIs used in the code. Use pine_reference and pine_search_docs to verify correct usage.',

      diagnose: 'Diagnose the root cause of identified issues. Analyze error patterns, trace through logic, and determine what needs to be fixed.',

      patch: 'Generate patches to fix identified issues. Use pine_patch to apply minimal, surgical edits that resolve problems without modifying unrelated code.',

      analyze: 'Perform comprehensive static analysis of the code. Identify complexity hotspots, optimization candidates, and structural issues.',

      scan: 'Scan the code for v5-specific APIs and patterns that need migration to v6. Create a list of required changes.',

      map_apis: 'Map v5 APIs to their v6 equivalents. Use pine_reference to verify correct v6 replacements for deprecated or changed APIs.',

      transform: 'Transform the code from v5 to v6 syntax. Apply API replacements and update any changed behavior.',

      optimize_candidates: 'Identify specific optimization candidates in the code. Look for repeated calculations, inefficient loops, and suboptimal data structures.',
    }

    const baseInstruction = stepInstructions[step] || `Execute step: ${step}`
    const previousContext = this.getPreviousStepContext()

    const fileDetails = [
      context.fileName ? `File: ${context.fileName}` : '',
      context.diagnostics ? `Diagnostics: ${context.diagnostics}` : '',
      context.selection ? `Selection: ${context.selection}` : '',
    ].filter(Boolean).join('\n')

    return `${baseInstruction}

${fileDetails ? `${fileDetails}\n` : ''}${previousContext ? `Context from previous steps:\n${previousContext}\n` : ''}User Request: ${userRequest}

Follow Pine v6 best practices and use available tools to complete this step.`
  }

  /**
   * Get context from completed steps
   */
  private getPreviousStepContext(): string {
    if (this.completedSteps.length === 0) {
      return ''
    }

    const contextLines: string[] = []
    for (const step of this.completedSteps) {
      const result = this.stepResults.get(step)
      if (result) {
        contextLines.push(`[${step}]: ${result.slice(0, 200)}...`)
      }
    }

    return contextLines.join('\n')
  }

  /**
   * Get current workflow progress
   */
  getProgress(): WorkflowProgress | null {
    if (!this.currentWorkflow || !this.currentStep) {
      return null
    }

    return {
      workflowType: this.currentWorkflow.type,
      currentStep: this.currentStep,
      totalSteps: this.currentWorkflow.steps.length,
      completedSteps: this.completedSteps.length,
      message: `Processing step: ${this.currentStep}`,
    }
  }

  /**
   * Cancel current workflow
   */
  cancel(): void {
    this.currentWorkflow = null
    this.currentStep = null
    this.completedSteps = []
    this.stepResults = new Map()
  }

  /**
   * Check if orchestrator is busy
   */
  isBusy(): boolean {
    return this.currentWorkflow !== null && this.currentStep !== null
  }

  /**
   * Get completed steps
   */
  getCompletedSteps(): WorkflowStep[] {
    return [...this.completedSteps]
  }
}
