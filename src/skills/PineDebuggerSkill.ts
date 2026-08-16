/**
 * PineDebuggerSkill - Debugging and instrumentation skill for Pine Script
 * 
 * Source concept: TradersPost pine-debugger skill
 * Purpose: Generate diagnostic instrumentation and identify issues
 */

import { PineSkill, PineSkillDefinition, PineSkillContext, PineSkillResult } from './PineSkill'

/**
 * Instrumentation patterns from TradersPost pine-debugger skill
 */
export type InstrumentationPattern =
  | 'label_value_inspector'
  | 'table_variable_monitor'
  | 'loop_iteration_debugger'
  | 'repainting_detector'
  | 'na_propagation_tracker'
  | 'request_security_debugger'
  | 'udt_state_inspector'
  | 'drawing_object_status'
  | 'xloc_validator'

export interface InstrumentationRequest {
  pattern: InstrumentationPattern
  targetSymbols?: string[]
  targetLines?: number[]
  options?: Record<string, unknown>
}

export interface DiagnosticSeries {
  name: string
  description: string
  dataPoints: Array<{
    barIndex: number
    timestamp: number
    value: number | string | boolean
  }>
}

/**
 * Debug patterns and their triggers
 */
export const DEBUG_PATTERNS = {
  repainting_detector: {
    id: 'DEBUG-REPAINT-001',
    name: 'Repainting Detector',
    description: 'Detect indicators that repaint on historical bars',
    triggers: ['repaint', 'realtime', 'historical', 'barstate'],
    checks: [
      'request.security lookahead usage',
      'barstate.isconfirmed vs barstate.isnew',
      'Close price usage on incomplete bars',
      'Value changes between bars',
    ],
  },
  
  na_propagation: {
    id: 'DEBUG-NA-001',
    name: 'NA Propagation Tracker',
    description: 'Track how NA values propagate through calculations',
    triggers: ['na', 'nan', 'null', 'undefined'],
    checks: [
      'Initial NA conditions',
      'Division by zero possibilities',
      'Array access out of bounds',
      'Function return NA propagation',
    ],
  },
  
  request_security: {
    id: 'DEBUG-HTF-001',
    name: 'Request.Security Debugger',
    description: 'Debug higher timeframe data access issues',
    triggers: ['request.security', 'HTF', 'higher timeframe', 'lower timeframe'],
    checks: [
      'Lookahead parameter usage',
      'Gaps handling',
      'Bar merging behavior',
      'Symbol resolution',
    ],
  },
  
  loop_debugger: {
    id: 'DEBUG-LOOP-001',
    name: 'Loop Iteration Debugger',
    description: 'Debug loop behavior and iteration counts',
    triggers: ['for', 'while', 'loop', 'iteration'],
    checks: [
      'Loop boundary calculation',
      'Iteration count limits',
      'Break/continue conditions',
      'State accumulation in loops',
    ],
  },
  
  label_inspector: {
    id: 'DEBUG-LABEL-001',
    name: 'Label Value Inspector',
    description: 'Display variable values using labels on chart',
    triggers: ['label', 'display', 'show value', 'inspect'],
    checks: [],
  },
  
  table_monitor: {
    id: 'DEBUG-TABLE-001',
    name: 'Table Variable Monitor',
    description: 'Monitor multiple variables in a table overlay',
    triggers: ['table', 'monitor', 'dashboard', 'panel'],
    checks: [],
  },
  
  udt_inspector: {
    id: 'DEBUG-UDT-001',
    name: 'UDT State Inspector',
    description: 'Inspect user-defined type state and fields',
    triggers: ['UDT', 'type', 'record', 'struct'],
    checks: [
      'Field initialization',
      'Type casting',
      'Nested UDT structure',
      'Array of UDTs',
    ],
  },
  
  drawing_validator: {
    id: 'DEBUG-DRAW-001',
    name: 'Drawing Object Status',
    description: 'Validate drawing object creation and positioning',
    triggers: ['line.new', 'box.new', 'label.new', 'drawing', 'draw'],
    checks: [
      'Coordinate validity',
      'xloc usage (bar_index vs bar_time)',
      'Object lifecycle management',
      'Max drawings limit',
    ],
  },
  
  xloc_validator: {
    id: 'DEBUG-XLOC-001',
    name: 'XLOC Validator',
    description: 'Validate xloc usage for drawing coordinates',
    triggers: ['xloc', 'xloc.bar_time', 'xloc.bar_index'],
    checks: [
      'Historical drawing coordinate type',
      'Time vs bar_index consistency',
      'Future bar references',
    ],
  },
} as const

export class PineDebuggerSkill extends PineSkill {
  readonly definition: PineSkillDefinition = {
    id: 'pine-debugger',
    name: 'Pine Debugger',
    description: 'Generate diagnostic instrumentation code to debug Pine Script issues including repainting, NA propagation, HTF problems, and more',
    version: '1.0.0',
    triggerPatterns: [
      'debug',
      'diagnose',
      'troubleshoot',
      'fix error',
      'why is',
      'not working',
      'repaint',
      'instrument',
      'trace',
      'inspect',
      'monitor',
    ],
    requiredTools: [
      'pine_analyze',
      'pine_validate',
    ],
    optionalTools: [
      'pine_search_docs',
      'pine_reference',
      'pine_patch',
      'pine_visualize',
    ],
  }
  
  /**
   * Execute the debugger skill
   */
  async execute(context: PineSkillContext): Promise<PineSkillResult> {
    const request = context.userRequest
    
    // Identify which debug patterns are relevant
    const relevantPatterns = this.identifyRelevantPatterns(request)
    
    // Analyze code if available
    const analysisResults = context.fileContent 
      ? this.analyzeCodeForIssues(context.fileContent, relevantPatterns)
      : null
    
    // Generate instrumentation code
    const instrumentationPlan = this.generateInstrumentationPlan(
      relevantPatterns,
      analysisResults,
      context,
    )
    
    return {
      success: true,
      content: instrumentationPlan.report,
      patches: instrumentationPlan.patches,
      diagnostics: instrumentationPlan.diagnostics,
      metadata: {
        patternsIdentified: relevantPatterns.map(p => p.id),
        issuesFound: analysisResults?.issues.length ?? 0,
        instrumentationGenerated: instrumentationPlan.codeSnippets.length,
      },
    }
  }
  
  /**
   * Identify relevant debug patterns based on request
   */
  private identifyRelevantPatterns(request: string): typeof DEBUG_PATTERNS[keyof typeof DEBUG_PATTERNS][] {
    const lower = request.toLowerCase()
    const patterns: typeof DEBUG_PATTERNS[keyof typeof DEBUG_PATTERNS][] = []
    
    for (const key in DEBUG_PATTERNS) {
      const pattern = DEBUG_PATTERNS[key as keyof typeof DEBUG_PATTERNS]
      
      // Check if any trigger word matches
      const hasTrigger = pattern.triggers.some(trigger =>
        lower.includes(trigger.toLowerCase()),
      )
      
      if (hasTrigger) {
        patterns.push(pattern)
      }
    }
    
    // Default to general inspection if no specific pattern found
    if (patterns.length === 0) {
      patterns.push(DEBUG_PATTERNS.label_inspector)
    }
    
    return patterns
  }
  
  /**
   * Analyze code for known issues
   */
  private analyzeCodeForIssues(
    code: string,
    patterns: typeof DEBUG_PATTERNS[keyof typeof DEBUG_PATTERNS][],
  ): { issues: Array<{ type: string; line: number; message: string }> } {
    const issues: Array<{ type: string; line: number; message: string }> = []
    const lines = code.split('\n')
    
    for (const pattern of patterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNum = i + 1
        
        // Check for pattern-specific issues
        for (const check of pattern.checks) {
          const issue = this.checkForIssue(line, lineNum, check.toLowerCase())
          if (issue) {
            issues.push(issue)
          }
        }
      }
    }
    
    return { issues }
  }
  
  /**
   * Check a single line for a specific issue type
   */
  private checkForIssue(
    line: string,
    lineNum: number,
    issueType: string,
  ): { type: string; line: number; message: string } | null {
    // Repainting checks
    if (issueType.includes('lookahead')) {
      if (line.includes('request.security') && line.includes('lookahead')) {
        return {
          type: 'potential_repaint',
          line: lineNum,
          message: 'request.security with lookahead parameter may cause repainting',
        }
      }
    }
    
    // NA propagation checks
    if (issueType.includes('division')) {
      if (line.includes('/') && !line.includes('//')) {
        return {
          type: 'potential_na',
          line: lineNum,
          message: 'Division operation detected - check for division by zero',
        }
      }
    }
    
    // Drawing coordinate checks
    if (issueType.includes('xloc')) {
      if (line.includes('line.new') || line.includes('box.new')) {
        if (!line.includes('xloc')) {
          return {
            type: 'drawing_coordinate',
            line: lineNum,
            message: 'Drawing without explicit xloc - consider xloc.bar_time for historical drawings',
          }
        }
      }
    }
    
    return null
  }
  
  /**
   * Generate instrumentation plan
   */
  private generateInstrumentationPlan(
    patterns: typeof DEBUG_PATTERNS[keyof typeof DEBUG_PATTERNS][],
    analysisResults: { issues: Array<{ type: string; line: number; message: string }> } | null,
    context: PineSkillContext,
  ): {
      report: string
      patches?: PineSkillResult['patches']
      diagnostics?: PineSkillResult['diagnostics']
      codeSnippets: string[]
    } {
    const reportLines: string[] = []
    const codeSnippets: string[] = []
    const diagnostics: PineSkillResult['diagnostics'] = []
    
    reportLines.push('# Pine Script Debug Analysis\n')
    if (context.fileName) {
      reportLines.push(`**File:** ${context.fileName}\n`)
    }
    
    // Report identified patterns
    reportLines.push(`## Debug Patterns Identified: ${patterns.length}\n`)
    for (const pattern of patterns) {
      reportLines.push(`- **${pattern.name}** (${pattern.id})`)
      reportLines.push(`  ${pattern.description}`)
      if (pattern.checks.length > 0) {
        reportLines.push(`  Checks: ${pattern.checks.join(', ')}`)
      }
      reportLines.push('')
    }
    
    // Report found issues
    if (analysisResults && analysisResults.issues.length > 0) {
      reportLines.push(`## Issues Found: ${analysisResults.issues.length}\n`)
      for (const issue of analysisResults.issues) {
        reportLines.push(`- Line ${issue.line}: ${issue.message}`)
        diagnostics?.push({
          line: issue.line,
          column: 0,
          severity: 'warning',
          message: issue.message,
        })
      }
      reportLines.push('')
    }
    
    // Generate instrumentation code
    reportLines.push('## Recommended Instrumentation\n')
    
    for (const pattern of patterns) {
      const instrumentation = this.generateInstrumentationForPattern(pattern)
      codeSnippets.push(`// --- ${pattern.name} ---\n${instrumentation.code}`)
      reportLines.push(`### ${pattern.name}\n${instrumentation.description}`)
      reportLines.push('```pine')
      reportLines.push(instrumentation.code)
      reportLines.push('```\n')
    }
    
    return {
      report: reportLines.join('\n'),
      diagnostics,
      codeSnippets,
    }
  }
  
  /**
   * Generate instrumentation code for a specific pattern
   */
  private generateInstrumentationForPattern(
    pattern: typeof DEBUG_PATTERNS[keyof typeof DEBUG_PATTERNS],
  ): { code: string; description: string } {
    switch (pattern.id) {
      case 'DEBUG-REPAINT-001':
        return this.generateRepaintDetector()
      
      case 'DEBUG-NA-001':
        return this.generateNATracker()
      
      case 'DEBUG-HTF-001':
        return this.generateHTFDebugger()
      
      case 'DEBUG-LOOP-001':
        return this.generateLoopDebugger()
      
      case 'DEBUG-LABEL-001':
        return this.generateLabelInspector()
      
      case 'DEBUG-TABLE-001':
        return this.generateTableMonitor()
      
      default:
        return {
          code: '// General instrumentation placeholder',
          description: 'General debugging instrumentation',
        }
    }
  }
  
  /**
   * Generate repainting detector instrumentation
   */
  private generateRepaintDetector(): { code: string; description: string } {
    return {
      code: `// Repainting Detector Instrumentation
// Compare realtime vs historical values

var int repaintChecks = 0
var int repaintChanges = 0

// Store previous bar's value for comparison
var float prevValue = na
float currentValue = close  // Replace with your indicator value

// Detect changes on confirmed bars
if barstate.isconfirmed and not na(prevValue)
    repaintChecks := repaintChecks + 1
    if currentValue != prevValue
        repaintChanges := repaintChanges + 1
        label.new(bar_index, high, 
             text = "Repaint detected!\\nPrev: " + str.tostring(prevValue) + "\\nCurr: " + str.tostring(currentValue),
             style = label.style_label_down,
             color = color.red,
             textcolor = color.white)

prevValue := currentValue

// Display repaint statistics
var table statsTable = table.new(position.top_right, 2, 3)
if barstate.islast
    table.cell(statsTable, 0, 0, "Repaint Stats")
    table.cell(statsTable, 1, 0, "Count")
    table.cell(statsTable, 0, 1, "Checks")
    table.cell(statsTable, 1, 1, str.tostring(repaintChecks))
    table.cell(statsTable, 0, 2, "Changes")
    table.cell(statsTable, 1, 2, str.tostring(repaintChanges))`,
      description: 'This instrumentation tracks value changes between realtime updates to detect repainting behavior.',
    }
  }
  
  /**
   * Generate NA propagation tracker
   */
  private generateNATracker(): { code: string; description: string } {
    return {
      code: `// NA Propagation Tracker
// Track where NA values originate and spread

// Track NA sources
bool naSource = false
string naReason = ""

// Check common NA causes
if close == 0
    naSource := true
    naReason := "Zero close price"

// Example: Division NA check
float divisor = ta.sma(volume, 20)
if divisor == 0
    naSource := true
    naReason := "Division by zero (SMA volume)"

// Track NA propagation
var int naCount = 0
if na(close) or na(open) or na(high) or na(low)
    naCount := naCount + 1

// Alert on NA detection
if naSource
    alert("NA Source detected: " + naReason, alert.freq_once_per_bar)

// Display NA statistics
if barstate.islast
    label.new(bar_index, low, 
         text = "NA Count: " + str.tostring(naCount),
         style = label.style_label_up,
         color = color.orange)`,
      description: 'This instrumentation identifies sources of NA values and tracks their propagation through calculations.',
    }
  }
  
  /**
   * Generate HTF (Higher Timeframe) debugger
   */
  private generateHTFDebugger(): { code: string; description: string } {
    return {
      code: `// HTF Request.Security Debugger
// Debug higher timeframe data access

// Test different lookahead settings
htfCloseNoLookahead = request.security(syminfo.tickerid, "D", close, lookahead = barmerge.lookahead_off)
htfCloseWithLookahead = request.security(syminfo.tickerid, "D", close, lookahead = barmerge.lookahead_on)

// Compare values
float htfDiff = htfCloseNoLookahead - htfCloseWithLookahead

// Log discrepancies
if htfDiff != 0
    label.new(bar_index, high, 
         text = "HTF Mismatch!\\nNo LA: " + str.tostring(htfCloseNoLookahead) + "\\nWith LA: " + str.tostring(htfCloseWithLookahead),
         style = label.style_label_down,
         color = color.orange)

// Track bar merge behavior
var int htfBarCount = 0
var float prevHtfTime = na
float currentHtfTime = request.security(syminfo.tickerid, "D", time)

if currentHtfTime != prevHtfTime
    htfBarCount := htfBarCount + 1
    prevHtfTime := currentHtfTime

// Display HTF info
if barstate.islast
    var table htfTable = table.new(position.bottom_left, 2, 4)
    table.cell(htfTable, 0, 0, "HTF Debug")
    table.cell(htfTable, 1, 0, "Value")
    table.cell(htfTable, 0, 1, "No Lookahead")
    table.cell(htfTable, 1, 1, str.tostring(htfCloseNoLookahead))
    table.cell(htfTable, 0, 2, "With Lookahead")
    table.cell(htfTable, 1, 2, str.tostring(htfCloseWithLookahead))
    table.cell(htfTable, 0, 3, "Difference")
    table.cell(htfTable, 1, 3, str.tostring(htfDiff))`,
      description: 'This instrumentation compares request.security behavior with different lookahead settings to identify HTF issues.',
    }
  }
  
  /**
   * Generate loop debugger
   */
  private generateLoopDebugger(): { code: string; description: string } {
    return {
      code: `// Loop Iteration Debugger
// Track loop behavior and iteration counts

var int totalIterations = 0
var int maxIterationsInLoop = 0
var int loopEntryCount = 0

// Example loop instrumentation
int myLimit = 100  // Replace with your actual limit
for i = 0 to myLimit - 1
    totalIterations := totalIterations + 1
    loopEntryCount := loopEntryCount + 1
    
    // Track max iterations per bar
    if totalIterations > maxIterationsInLoop
        maxIterationsInLoop := totalIterations
    
    // Break condition logging
    if i > 50  // Replace with your break condition
        label.new(bar_index, high, 
             text = "Loop break at i=" + str.tostring(i),
             style = label.style_label_down,
             color = color.yellow)
        break

// Reset counter each bar
totalIterations := 0

// Display loop statistics
if barstate.islast
    var table loopTable = table.new(position.middle_right, 2, 3)
    table.cell(loopTable, 0, 0, "Loop Stats")
    table.cell(loopTable, 1, 0, "Count")
    table.cell(loopTable, 0, 1, "Entries")
    table.cell(loopTable, 1, 1, str.tostring(loopEntryCount))
    table.cell(loopTable, 0, 2, "Max Iterations")
    table.cell(loopTable, 1, 2, str.tostring(maxIterationsInLoop))`,
      description: 'This instrumentation tracks loop iteration counts and identifies potential infinite loop conditions.',
    }
  }
  
  /**
   * Generate label value inspector
   */
  private generateLabelInspector(): { code: string; description: string } {
    return {
      code: `// Label Value Inspector
// Display variable values on chart using labels

// Create inspection labels
inspectPrice = close
inspectVolume = volume
inspectRSI = ta.rsi(close, 14)

// Show values on last bar
if barstate.islast
    label.new(bar_index, high, 
         text = "Price: " + str.tostring(inspectPrice) + 
              "\\nVolume: " + str.tostring(inspectVolume) +
              "\\nRSI: " + str.tostring(inspectRSI, "#.##"),
         style = label.style_label_down,
         color = color.blue,
         textcolor = color.white,
         size = size.small)

// Alternative: Click-based inspection (using alerts)
// alertcondition(barstate.islast, "Inspect Values", 
//     "Price: {{close}}\\nVolume: {{volume}}\\nRSI: " + str.tostring(inspectRSI, "#.##"))`,
      description: 'This instrumentation displays variable values directly on the chart using labels for easy visual inspection.',
    }
  }
  
  /**
   * Generate table variable monitor
   */
  private generateTableMonitor(): { code: string; description: string } {
    return {
      code: `// Table Variable Monitor
// Monitor multiple variables in a dashboard table

var table monitorTable = table.new(position.top_right, 3, 8, bgcolor = color.black)

// Update table on last bar
if barstate.islast
    // Header
    table.cell(monitorTable, 0, 0, "Variable", bgcolor = color.gray)
    table.cell(monitorTable, 1, 0, "Value", bgcolor = color.gray)
    table.cell(monitorTable, 2, 0, "Status", bgcolor = color.gray)
    
    // Price info
    table.cell(monitorTable, 0, 1, "Close")
    table.cell(monitorTable, 1, 1, str.tostring(close, "#.##"))
    table.cell(monitorTable, 2, 1, close > open ? "▲" : "▼")
    
    table.cell(monitorTable, 0, 2, "Open")
    table.cell(monitorTable, 1, 2, str.tostring(open, "#.##"))
    
    table.cell(monitorTable, 0, 3, "High")
    table.cell(monitorTable, 1, 3, str.tostring(high, "#.##"))
    
    table.cell(monitorTable, 0, 4, "Low")
    table.cell(monitorTable, 1, 4, str.tostring(low, "#.##"))
    
    table.cell(monitorTable, 0, 5, "Volume")
    table.cell(monitorTable, 1, 5, str.tostring(volume, "#"))
    
    // RSI
    float rsi = ta.rsi(close, 14)
    table.cell(monitorTable, 0, 6, "RSI(14)")
    table.cell(monitorTable, 1, 6, str.tostring(rsi, "#.##"))
    table.cell(monitorTable, 2, 6, rsi > 70 ? "OB" : rsi < 30 ? "OS" : "")
    
    // ATR
    float atr = ta.atr(14)
    table.cell(monitorTable, 0, 7, "ATR(14)")
    table.cell(monitorTable, 1, 7, str.tostring(atr, "#.##"))`,
      description: 'This instrumentation creates a persistent dashboard table showing multiple variable values for real-time monitoring.',
    }
  }
}
