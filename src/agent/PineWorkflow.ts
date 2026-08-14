/**
 * PineWorkflow - Workflow definitions for PineForge agent orchestration
 * 
 * Source concept: TradersPost pine-manager skill workflows
 */

export type WorkflowStep =
  | 'research'
  | 'design'
  | 'visualize'
  | 'develop'
  | 'validate'
  | 'debug'
  | 'optimize'
  | 'backtest'
  | 'inspect'
  | 'reference_lookup'
  | 'diagnose'
  | 'patch'
  | 'analyze'
  | 'scan'
  | 'map_apis'
  | 'transform'
  | 'optimize_candidates'

export type PineWorkflowType =
  | 'create_indicator'
  | 'create_strategy'
  | 'debug'
  | 'refactor'
  | 'optimize'
  | 'migrate_v5_v6'
  | 'backtest'
  | 'publish'
  | 'explain'
  | 'fix'

export interface PineWorkflow {
  type: PineWorkflowType
  description: string
  steps: WorkflowStep[]
  requiredTools: string[]
  optionalTools: string[]
  expectedOutput: string
}

export const PINE_WORKFLOWS: Record<PineWorkflowType, PineWorkflow> = {
  create_indicator: {
    type: 'create_indicator',
    description: 'Create a new Pine Script indicator from concept to validated code',
    steps: [
      'research',
      'visualize',
      'develop',
      'validate',
      'debug',
      'optimize',
    ],
    requiredTools: [
      'pine_search_docs',
      'pine_reference',
      'pine_validate',
    ],
    optionalTools: [
      'pine_examples',
      'pine_analyze',
      'pine_visualize',
    ],
    expectedOutput: 'Validated Pine Script indicator code ready for use',
  },

  create_strategy: {
    type: 'create_strategy',
    description: 'Create a new Pine Script strategy with backtesting support',
    steps: [
      'research',
      'design',
      'develop',
      'validate',
      'backtest',
      'debug',
      'optimize',
    ],
    requiredTools: [
      'pine_search_docs',
      'pine_reference',
      'pine_validate',
      'pine_backtest',
    ],
    optionalTools: [
      'pine_examples',
      'pine_analyze',
      'pine_visualize',
      'pine_optimize',
    ],
    expectedOutput: 'Validated Pine Script strategy with backtest results',
  },

  debug: {
    type: 'debug',
    description: 'Diagnose and fix issues in existing Pine Script code',
    steps: [
      'inspect',
      'reference_lookup',
      'diagnose',
      'patch',
      'validate',
    ],
    requiredTools: [
      'pine_analyze',
      'pine_validate',
      'pine_debug',
    ],
    optionalTools: [
      'pine_search_docs',
      'pine_reference',
      'pine_patch',
    ],
    expectedOutput: 'Diagnosed issues with patches applied and validated',
  },

  refactor: {
    type: 'refactor',
    description: 'Refactor Pine Script code for better structure and maintainability',
    steps: [
      'analyze',
      'optimize_candidates',
      'reference_lookup',
      'patch',
      'validate',
    ],
    requiredTools: [
      'pine_analyze',
      'pine_validate',
    ],
    optionalTools: [
      'pine_reference',
      'pine_patch',
      'pine_optimize',
    ],
    expectedOutput: 'Refactored code with improved structure and validated correctness',
  },

  optimize: {
    type: 'optimize',
    description: 'Optimize Pine Script code for performance and efficiency',
    steps: [
      'analyze',
      'optimize_candidates',
      'reference_lookup',
      'patch',
      'validate',
    ],
    requiredTools: [
      'pine_analyze',
      'pine_validate',
      'pine_optimize',
    ],
    optionalTools: [
      'pine_reference',
      'pine_patch',
    ],
    expectedOutput: 'Optimized code with performance improvement report',
  },

  migrate_v5_v6: {
    type: 'migrate_v5_v6',
    description: 'Migrate Pine Script v5 code to v6 syntax and APIs',
    steps: [
      'scan',
      'map_apis',
      'transform',
      'validate',
    ],
    requiredTools: [
      'pine_analyze',
      'pine_validate',
      'pine_reference',
    ],
    optionalTools: [
      'pine_patch',
      'pine_examples',
    ],
    expectedOutput: 'Migrated v6 code with migration report listing changes',
  },

  backtest: {
    type: 'backtest',
    description: 'Run backtest analysis on a Pine Script strategy',
    steps: [
      'validate',
      'backtest',
      'analyze',
      'diagnose',
    ],
    requiredTools: [
      'pine_validate',
      'pine_backtest',
    ],
    optionalTools: [
      'pine_analyze',
      'pine_visualize',
    ],
    expectedOutput: 'Backtest results with metrics and analysis',
  },

  publish: {
    type: 'publish',
    description: 'Prepare and publish Pine Script to TradingView',
    steps: [
      'validate',
      'optimize',
      'design',
    ],
    requiredTools: [
      'pine_validate',
    ],
    optionalTools: [
      'pine_optimize',
    ],
    expectedOutput: 'Publish-ready code with documentation',
  },

  explain: {
    type: 'explain',
    description: 'Explain Pine Script code functionality and behavior',
    steps: [
      'analyze',
      'research',
      'reference_lookup',
    ],
    requiredTools: [
      'pine_analyze',
      'pine_search_docs',
    ],
    optionalTools: [
      'pine_reference',
      'pine_examples',
    ],
    expectedOutput: 'Detailed explanation of code behavior and structure',
  },

  fix: {
    type: 'fix',
    description: 'Fix compilation errors and diagnostics in Pine Script code',
    steps: [
      'inspect',
      'reference_lookup',
      'diagnose',
      'patch',
      'validate',
    ],
    requiredTools: [
      'pine_validate',
      'pine_patch',
    ],
    optionalTools: [
      'pine_reference',
      'pine_search_docs',
      'pine_analyze',
    ],
    expectedOutput: 'Fixed code with all diagnostics resolved',
  },
}

/**
 * Get workflow by type
 */
export function getWorkflow(type: PineWorkflowType): PineWorkflow {
  return PINE_WORKFLOWS[type]
}

/**
 * Get all available workflow types
 */
export function getAvailableWorkflows(): PineWorkflowType[] {
  return Object.keys(PINE_WORKFLOWS) as PineWorkflowType[]
}

/**
 * Check if a step is valid for a workflow
 */
export function isValidStep(workflowType: PineWorkflowType, step: WorkflowStep): boolean {
  const workflow = PINE_WORKFLOWS[workflowType]
  return workflow?.steps.includes(step) ?? false
}

/**
 * Get the next step in a workflow
 */
export function getNextStep(
  workflowType: PineWorkflowType,
  currentStep: WorkflowStep,
): WorkflowStep | undefined {
  const workflow = PINE_WORKFLOWS[workflowType]
  if (!workflow) {return undefined}

  const currentIndex = workflow.steps.indexOf(currentStep)
  if (currentIndex === -1 || currentIndex >= workflow.steps.length - 1) {
    return undefined
  }

  return workflow.steps[currentIndex + 1]
}

/**
 * Get the first step in a workflow
 */
export function getFirstStep(workflowType: PineWorkflowType): WorkflowStep | undefined {
  const workflow = PINE_WORKFLOWS[workflowType]
  return workflow?.steps[0]
}

/**
 * Check if workflow is complete
 */
export function isWorkflowComplete(
  workflowType: PineWorkflowType,
  currentStep: WorkflowStep,
): boolean {
  const workflow = PINE_WORKFLOWS[workflowType]
  if (!workflow) {return false}

  const lastStep = workflow.steps[workflow.steps.length - 1]
  return currentStep === lastStep
}
