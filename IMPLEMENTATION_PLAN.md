# PineForge Implementation Plan

## Priority Mapping from TradersPost/pinescript-agents

Based on the comparative analysis, here's what we should implement in priority order:

---

## P0 - Foundation (Week 1-2)

### 1. PineAgentOrchestrator
**Source:** TradersPost `pine-manager` skill  
**Purpose:** Coordinate multi-stage workflows instead of single ReAct loop

**Implementation:**
```
src/agent/PineAgentOrchestrator.ts
src/agent/PineWorkflow.ts
```

**Workflows to support:**
- `create_indicator`: research → visualize → develop → validate → debug → optimize
- `create_strategy`: research → design → develop → validate → backtest → debug → optimize
- `debug`: inspect → reference_lookup → diagnose → patch → validate
- `refactor`: analyze → optimize_candidates → reference_lookup → patch → validate
- `migrate_v5_v6`: scan → map_apis → transform → validate

---

### 2. Skill-Based Architecture
**Source:** TradersPost skills (pine-developer, pine-debugger, etc.)  
**Purpose:** Modular capabilities instead of monolithic system prompt

**Implementation:**
```
src/skills/
├── PineSkill.ts                 # Base skill interface
├── PineSkillRegistry.ts         # Discover/load/compose skills
├── pine-developer/SKILL.md      # Developer skill definition
├── pine-debugger/SKILL.md       # Debugger skill definition
├── pine-optimizer/SKILL.md      # Optimizer skill definition
├── pine-backtester/SKILL.md     # Backtester skill definition
├── pine-visualizer/SKILL.md     # Visualizer skill definition
└── pine-publisher/SKILL.md      # Publisher skill definition
```

**Key rules from pine-developer to migrate:**
- UDT-first architecture (PINE-ARCH-001)
- xloc.bar_time for historical drawings (PINE-DRAW-001)
- Loop semantics v6 changes
- Input organization patterns

---

### 3. Expanded Tool Registry
**Source:** TradersPost MCP tools + our native capabilities

**Tools to implement:**
```
src/tools/
├── PineReferenceTool.ts         # pine_reference - Get exact reference
├── PineGuideTool.ts             # pine_guide - Get usage guide
├── PineExamplesTool.ts          # pine_examples - Get code examples
├── PineParseTool.ts             # pine_parse - Parse Pine AST
├── PineAnalyzeTool.ts           # pine_analyze - Static analysis
├── PineDebugTool.ts             # pine_debug - Instrumentation patterns
├── PinePatchTool.ts             # pine_patch - Apply unified diff
├── PineVisualizeTool.ts         # pine_visualize - Chart commands
└── PineLintTool.ts              # pine_lint - Lint diagnostics
```

---

### 4. VS Code Event Hooks
**Source:** TradersPost `.claude/hooks` concept  
**Purpose:** Automatic validation after edits

**Implementation:**
```
src/hooks/
├── BeforeWriteHook.ts           # workspace.onWillSaveTextDocument
├── AfterEditHook.ts             # workspace.onDidChangeTextDocument
├── WorkspaceGuard.ts            # Protected paths enforcement
└── PineForgeStatusBar.ts        # Status panel
```

**Events to handle:**
- `onWillSaveTextDocument` → Validate before save
- `onDidChangeTextDocument` → Parse + static analysis
- `onDidSaveTextDocument` → Full validation
- `onDidChangeActiveTextEditor` → Context switch

---

### 5. Protected Paths
**Source:** TradersPost `.claude/protected-paths.json`

**Implementation:**
```json
{
  "protected": [
    "**/.git/**",
    "**/node_modules/**",
    "**/.env*",
    "**/Pine_Script_Documentation/**"
  ],
  "pineProtected": [
    "pineDocs.json",
    "pineReferenceManifest.json"
  ]
}
```

---

## P1 - Enhanced Capabilities (Week 3-4)

### 6. Pine Debugger Skill
**Source:** TradersPost `pine-debugger` skill

**Instrumentation patterns to implement:**
- Label value inspector
- Table variable monitor
- Loop iteration debugger
- Repainting detector
- NA propagation tracker
- request.security debugger
- UDT state inspector
- Drawing object status
- xloc validator

**Output:** Diagnostic instrumentation code + chart data series

---

### 7. Pine Optimizer Skill
**Source:** TradersPost `pine-optimizer` skill

**Optimization heuristics:**
- Calculation caching (repeated ta.sma())
- request.security tuple consolidation
- Loop optimization (cache boundaries)
- Cheap conditions first
- UDT architecture recommendations
- Input organization
- Visual styling cleanup
- Alert construction

**Output:** Optimization report with estimated improvements

---

### 8. Pine Visualizer Skill
**Source:** TradersPost `pine-visualizer` skill

**Integration with:**
- VS Code Webview
- Lightweight Charts
- Agent-generated visualization commands

**Commands:**
- "Show me where the BOS occurred"
- "Visualize the FVG"
- "Highlight the liquidity sweep"
- "Show me why this entry happened"
- "Compare signals between 5m and 15m"

---

### 9. Slash Commands
**Source:** TradersPost `.claude/commands/`

**Commands:**
```
@pine /create      - Create new indicator/strategy
@pine /fix         - Fix diagnostics
@pine /explain     - Explain code
@pine /refactor    - Refactor code
@pine /optimize    - Optimize performance
@pine /migrate     - Migrate v5 → v6
@pine /debug       - Debug repainting/issues
@pine /validate    - Validate code
@pine /backtest    - Run backtest
@pine /visualize   - Show chart
@pine /publish     - Publish workflow
```

---

## P2 - Advanced Features (Week 5+)

### 10. Pine Backtester Skill
**Source:** TradersPost `pine-backtester` skill (workflow only, not metrics)

**Important:** Do NOT copy their statistical trust model

**Our approach:**
```
Pine Script
    ↓
TradingView baseline metrics

         +

Native TS Research Engine
    ↓
event-driven simulation
slippage, commission, latency
walk-forward, Monte Carlo
regime analysis
```

---

### 11. Pine Publisher Skill
**Source:** TradersPost `pine-publisher` skill

**Workflow:**
- Version management
- Change log generation
- TradingView publish workflow
- Community sharing preparation

---

### 12. Chart Webview Integration
**Source:** TradersPost `pine-visualizer` + our existing plans

**Components:**
```
src/webviews/chart/
├── ChartWebview.ts
├── LightweightChartsAdapter.ts
├── DiagnosticOverlays.ts
└── BacktestVisualization.ts
```

---

## Architecture Changes Required

### Current Structure:
```
PineAgent (monolithic)
    ├── OllamaClient
    ├── PineAgentState
    ├── PineAgentPolicy
    └── Tools[]
```

### Target Structure:
```
PineAgentOrchestrator
    │
    ├── Workflow Engine
    │   ├── create_indicator workflow
    │   ├── create_strategy workflow
    │   ├── debug workflow
    │   └── ...
    │
    ├── Skill Registry
    │   ├── DeveloperSkill
    │   ├── DebuggerSkill
    │   ├── OptimizerSkill
    │   ├── BacktesterSkill
    │   ├── VisualizerSkill
    │   └── PublisherSkill
    │
    ├── Tool Registry
    │   ├── pine_reference
    │   ├── pine_search
    │   ├── pine_examples
    │   ├── pine_parse
    │   ├── pine_analyze
    │   ├── pine_validate
    │   ├── pine_debug
    │   ├── pine_patch
    │   └── pine_visualize
    │
    ├── Knowledge Engine (existing)
    │   ├── Exact lookup
    │   ├── Lexical search
    │   └── Reference graph
    │
    └── VS Code Hooks
        ├── BeforeWrite
        ├── AfterEdit
        └── WorkspaceGuard
```

---

## Knowledge Hierarchy (Critical)

**Must maintain this order:**
1. TradingView reference (ultimate source of truth)
2. TradingView language documentation
3. TradingView release notes
4. PineForge conformance manifest
5. TradingView compiler validation
6. PineForge skills (engineering heuristics)
7. LLM learned knowledge (least trusted)

**Rule:** TradersPost skills tell the model *how* to work. TradingView tells it *what* is true.

---

## What NOT to Copy

1. **Their agent runtime** - We use Ollama + TypeScript + VS Code, not Claude Code
2. **Their documentation snapshot as truth** - We have official-reference synchronization
3. **Their backtester as quant engine** - We keep research engine separate and deterministic

---

## Immediate Next Steps (This Session)

1. ✅ Create `PineAgentOrchestrator.ts` with workflow definitions - **DONE**
2. ✅ Create skill registry infrastructure - **DONE** (`PineSkillRegistry.ts`)
3. ✅ Create base `PineSkill` interface - **DONE** (`PineSkill.ts`)
4. ✅ Implement `PineDeveloperSkill` with key rules from TradersPost - **DONE**
5. ✅ Implement `PineDebuggerSkill` with instrumentation patterns - **DONE**
6. ✅ Create `PinePatchTool` for safe editing - **DONE**
7. ⏳ Create `BeforeWriteHook` and `AfterEditHook` - Partially done via `WorkspaceGuard`
8. ✅ Create `WorkspaceGuard` with protected paths - **DONE**
9. ✅ Create `PineForgeStatusBar` for status panel - **DONE**

---

## Success Metrics

- [ ] Agent can execute multi-stage workflows (not just single ReAct loop)
- [ ] Skills are loaded from markdown files (not hardcoded)
- [ ] Validation runs automatically after edits
- [ ] Protected paths prevent accidental modifications
- [ ] Status panel shows real-time agent state
- [ ] Debugger skill generates instrumentation code
- [ ] Optimizer skill provides concrete refactoring recommendations
