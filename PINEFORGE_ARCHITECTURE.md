# PineForge Agent Architecture

## Overview

PineForge is a Pine Script v6 engineering environment with local Ollama integration, deterministic tooling, and self-correcting code generation.

## Core Principles

1. **Ollama proposes, Pine tooling verifies, TradingView adjudicates**
2. **Retrieve, don't dump** - Never send entire pineDocs.json to LLM
3. **Minimal patches** - Prefer surgical edits over full-file regeneration
4. **Validation-first** - Generate → Validate → Repair → Revalidate
5. **Read/write separation** - Read tools run automatically; write tools require confirmation

## Directory Structure

```
src/
├── agent/
│   ├── PineAgent.ts           # Main agent orchestrator
│   ├── PineAgentLoop.ts       # Agent execution loop with state machine
│   ├── PineAgentState.ts      # State types and transitions
│   ├── PineAgentContext.ts    # Context builder for LLM requests
│   ├── PineAgentPolicy.ts     # Rules and constraints
│   └── PineAgentTelemetry.ts  # Execution telemetry (not chain-of-thought)
│
├── ollama/
│   ├── OllamaClient.ts        # Ollama API client with streaming
│   ├── OllamaModel.ts         # Model configuration
│   ├── OllamaToolAdapter.ts   # Tool calling adapter
│   └── OllamaStream.ts        # Streaming response handler
│
├── knowledge/
│   ├── PineKnowledgeEngine.ts # Hybrid RAG system
│   ├── PineDocIndex.ts        # Document indexing
│   ├── PineReferenceGraph.ts  # Reference relationship graph
│   ├── PineReferenceResolver.ts # Symbol resolution
│   └── PineExampleSearch.ts   # Example search
│
├── tools/
│   ├── PineSearchDocsTool.ts      # Tier 1: Exact symbol lookup
│   ├── PineGetReferenceTool.ts    # Get reference by name
│   ├── PineGetSignatureTool.ts    # Get function signature
│   ├── PineReadFileTool.ts        # Read current file
│   ├── PineGetSelectionTool.ts    # Get editor selection
│   ├── PineParseTool.ts           # Parse Pine code
│   ├── PineAnalyzeTool.ts         # Static analysis
│   ├── PineLintTool.ts            # Lint diagnostics
│   ├── PineValidateTool.ts        # Full validation (syntax + types + references)
│   ├── PineApplyPatchTool.ts      # Apply unified diff patch
│   ├── PineReplaceSelectionTool.ts # Replace selected text
│   ├── PineCreateFileTool.ts      # Create new Pine file
│   └── PineChartTool.ts           # Chart visualization commands
│
├── chat/
│   ├── PineChatParticipant.ts     # VS Code Chat Participant (@pine)
│   ├── PineChatCommands.ts        # Slash commands (/fix, /build, /migrate, etc.)
│   └── PineChatContext.ts         # Chat context management
│
├── conformance/
│   ├── PineReferenceManifest.ts   # TradingView reference manifest
│   ├── PineGapDetector.ts         # Detect gaps in our implementation
│   └── PineConformanceEngine.ts   # Conformance validation
│
└── webviews/
    └── chart/
        ├── ChartWebview.ts        # Chart visualization
        └── LightweightCharts.ts   # Chart rendering
```

## Agent State Machine

```
PLANNING
   ↓
RESEARCH (retrieve references)
   ↓
GENERATING (produce code/patch)
   ↓
VALIDATING (run pine_validate)
   ↓
REPAIRING (if validation fails)
   ↓
READY_TO_APPLY
   ↓
APPLIED (after user confirmation)
```

## Tool Categories

### Read-Only Tools (Auto-run)
- `pine_search_docs(query)` - Search documentation
- `pine_get_reference(symbol)` - Get exact reference
- `pine_get_signature(symbol)` - Get function/method signature
- `pine_get_current_file()` - Get active editor content
- `pine_get_selection()` - Get selected text
- `pine_parse(code)` - Parse Pine code
- `pine_analyze(code)` - Run static analyzer
- `pine_lint(code)` - Get lint diagnostics
- `pine_get_gap(symbol)` - Check reference gaps

### Mutating Tools (Require Confirmation)
- `pine_apply_patch(file, patch)` - Apply unified diff
- `pine_replace_selection(file, newText)` - Replace selection
- `pine_create_file(path, content)` - Create new file
- `pine_chart_add_marker(data)` - Add chart marker

## Knowledge Engine Tiers

### Tier 1 — Exact Symbol Lookup
```typescript
query("request.security") → request.security reference
query("array.sort") → array.sort reference
query("box.new") → box.new reference
```

### Tier 2 — Lexical Search
```typescript
search("dynamic requests") → relevant functions
search("order blocks") → box-related functions
search("negative array index") → array bounds warnings
```

### Tier 3 — Semantic Search (optional)
Embeddings-based fallback for ambiguous queries

### Tier 4 — Reference Graph
```typescript
box.new
   ├── box.set_right
   ├── box.set_left
   ├── box.set_top
   ├── box.set_bottom
   ├── box.set_bgcolor
   ├── box.delete
   └── box.all
```

## Configuration Schema

```json
{
  "pineForge.ollama.host": "http://localhost:11434",
  "pineForge.ollama.model": "qwen3",
  "pineForge.ollama.temperature": 0,
  "pineForge.agent.maxIterations": 12,
  "pineForge.agent.autoRepair": true,
  "pineForge.agent.autoApply": false,
  "pineForge.chart.enabled": true
}
```

## Chat Participant Commands

- `@pine /explain` - Explain selected code
- `@pine /fix` - Fix errors in current file
- `@pine /build` - Build indicator/strategy from description
- `@pine /refactor` - Refactor code
- `@pine /migrate` - Migrate v5 → v6
- `@pine /optimize` - Optimize without changing logic
- `@pine /test` - Generate test cases
- `@pine /validate` - Validate against Pine v6 reference
- `@pine /docs` - Show relevant documentation
- `@pine /backtest` - Visualize backtest results

## Validation Pipeline

```
User Request
    ↓
Pine Agent
    ↓
Local Analyzer (PineStaticAnalyzer)
    │
    ├─ PASS → TradingView Validation (future)
    │              │
    │              ├─ PASS → Ready to Apply
    │              └─ FAIL → Repair Loop
    │
    └─ FAIL → Repair Loop
                 │
                 ├─ Search References
                 ├─ Generate Patch
                 └─ Re-validate
```

## Implementation Progress

### ✅ Phase 1 - Ollama Foundation (COMPLETE)
- [x] OllamaClient with streaming and tool calling
- [x] Model configuration
- [x] Connection health check
- [x] Agent loop execution

### ✅ Phase 2 - Pine Knowledge (COMPLETE)
- [x] PineKnowledgeEngine
- [x] Exact symbol lookup (Tier 1)
- [x] Lexical search (Tier 2)
- [x] Reference graph (Tier 4)

### ✅ Phase 3 - Agent Core (COMPLETE)
- [x] PineAgent orchestrator
- [x] PineAgentState state machine
- [x] PineAgentPolicy rules engine
- [x] Context builder

### 🚧 Phase 4 - Deterministic Tools (IN PROGRESS)
- [x] pine_search_docs (Tier 1 lookup)
- [x] pine_validate (static analysis + reference conformance)
- [ ] pine_get_reference
- [ ] pine_get_signature
- [ ] pine_read_file
- [ ] pine_get_selection
- [ ] pine_parse
- [ ] pine_analyze
- [ ] pine_lint

### ⏳ Phase 5 - Repair Agent (PENDING)
- [ ] Generate code from references
- [ ] Validate
- [ ] Diagnose failures
- [ ] Generate patch
- [ ] Revalidate loop

### ⏳ Phase 6 - Safe Editing (PENDING)
- [ ] Diff preview
- [ ] User approval flow
- [ ] Apply patch
- [ ] Rollback support

### ⏳ Phase 7 - Chat Participant (PENDING)
- [ ] VS Code Chat Participant registration
- [ ] @pine commands
- [ ] Slash commands (/fix, /build, /migrate, etc.)
- [ ] Streaming responses in chat UI

### ⏳ Phase 8 - Pine Conformance (PENDING)
- [ ] TradingView reference manifest
- [ ] Gap detection
- [ ] Compiler validation integration

### ⏳ Phase 9 - Chart Visualization (PENDING)
- [ ] Webview panel
- [ ] Lightweight Charts integration
- [ ] Backtest visualization

---

## File Inventory

### Implemented Files

```
src/
├── agent/
│   ├── PineAgent.ts           ✅ Main agent orchestrator
│   ├── PineAgentState.ts      ✅ State machine
│   └── PineAgentPolicy.ts     ✅ Rules and constraints
│
├── ollama/
│   └── OllamaClient.ts        ✅ Ollama API client
│
├── knowledge/
│   └── PineKnowledgeEngine.ts ✅ Hybrid RAG system
│
└── tools/
    ├── PineTool.ts            ✅ Base tool interface
    ├── PineSearchDocsTool.ts  ✅ Documentation search
    └── PineValidateTool.ts    ✅ Validation tool
```

### Remaining to Implement

```
src/
├── tools/
│   ├── PineGetReferenceTool.ts
│   ├── PineGetSignatureTool.ts
│   ├── PineReadFileTool.ts
│   ├── PineGetSelectionTool.ts
│   ├── PineParseTool.ts
│   ├── PineAnalyzeTool.ts
│   ├── PineLintTool.ts
│   ├── PineApplyPatchTool.ts
│   └── PineChartTool.ts
│
├── chat/
│   ├── PineChatParticipant.ts
│   ├── PineChatCommands.ts
│   └── PineChatContext.ts
│
├── conformance/
│   ├── PineReferenceManifest.ts
│   ├── PineGapDetector.ts
│   └── PineConformanceEngine.ts
│
└── webviews/
    └── chart/
        ├── ChartWebview.ts
        └── LightweightCharts.ts
```

## System Prompt Template

```
You are PineForge, a Pine Script v6 engineering agent.

Rules:
1. Pine v6 only.
2. Never invent APIs.
3. Use PineReference tools before introducing unfamiliar APIs.
4. Never assume a function signature.
5. Validate generated code.
6. Prefer minimal patches.
7. Never modify unrelated code.
8. Never silently change trading semantics.
9. Preserve existing strategy behavior unless requested.
10. If validation fails, repair and revalidate.

Current File: {file}
Diagnostics: {diagnostics}
Relevant References: {references}
User Request: {request}
```

## Key Differentiators

1. **Not "Pine Script ChatGPT"** - This is a deterministic engineering environment
2. **LLM is not source of truth** - TradingView Reference > Pine Manifest > Knowledge Engine > Static Analyzer > LLM
3. **Self-correcting** - Automatic repair loops on validation failures
4. **Hybrid RAG** - Exact lookup + lexical + graph > embeddings-only
5. **Safe mutations** - All edits require approval with diff preview
6. **Execution telemetry** - Show what agent did, not hidden reasoning
