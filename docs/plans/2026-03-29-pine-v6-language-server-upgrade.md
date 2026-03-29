# Pine Script v6 Language Server Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the Pine Script v6 VS Code extension to full v6 parity — add missing language features, build local static analysis (including array out-of-bounds detection), and create a comprehensive automated test suite.

**Architecture:** The extension is a single-process VS Code language client (no separate LSP server). All validation currently goes through TradingView's remote `translate_light` API. We will add a local `PineStaticAnalyzer` that runs alongside the remote lint to catch issues like array out-of-bounds, bool/na misuse, and int-to-bool casting — problems the remote API doesn't surface as actionable warnings. The analyzer produces `vscode.Diagnostic` entries that merge with the API response. Testing uses Vitest (fast, TS-native, no heavy VS Code test host needed for unit tests) plus VS Code integration tests for provider verification.

**Tech Stack:** TypeScript 5.7, Vitest, @vscode/test-electron (integration), webpack 5, VS Code Extension API 1.93+

---

## Phase 1: Test Infrastructure

### Task 1.1: Install Test Dependencies

**Files:**
- Modify: `package.json:65-92` (dependencies)

**Step 1: Install vitest and testing utilities**

```bash
cd "/Users/tradesdontlie/Tradingview VSXIX/pine-script-v6-extension"
pnpm add -D vitest @vitest/coverage-v8
```

**Step 2: Add test scripts to package.json**

Add these scripts to the `"scripts"` block in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add vitest test framework and coverage tooling"
```

---

### Task 1.2: Create Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

**Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'out'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/extension.ts', 'src/index.ts'],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'test/__mocks__/vscode.ts'),
    },
  },
})
```

**Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest configuration"
```

---

### Task 1.3: Create VS Code Mock

**Files:**
- Create: `test/__mocks__/vscode.ts`

**Step 1: Create the mock**

This mock provides the minimum VS Code API surface needed for unit testing providers without launching a real VS Code instance.

```typescript
// Minimal vscode mock for unit testing
export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number,
  ) {}
}

export class Position {
  constructor(
    public line: number,
    public character: number,
  ) {}
}

export class Diagnostic {
  constructor(
    public range: Range,
    public message: string,
    public severity?: DiagnosticSeverity,
  ) {}
}

export const languages = {
  createDiagnosticCollection: (name: string) => ({
    name,
    set: () => {},
    delete: () => {},
    clear: () => {},
    dispose: () => {},
  }),
}

export const window = {
  activeTextEditor: undefined,
  showInformationMessage: () => {},
  showWarningMessage: () => {},
  showErrorMessage: () => {},
}

export const workspace = {
  getConfiguration: () => ({
    get: () => undefined,
    update: () => Promise.resolve(),
  }),
}

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file' }),
}

export enum CompletionItemKind {
  Function = 2,
  Method = 1,
  Variable = 5,
  Class = 6,
  Enum = 12,
  EnumMember = 19,
  Constant = 20,
  Property = 9,
  Field = 4,
  Keyword = 13,
}
```

**Step 2: Commit**

```bash
git add test/__mocks__/vscode.ts
git commit -m "chore: add vscode mock for unit testing"
```

---

### Task 1.4: First Smoke Test

**Files:**
- Create: `test/smoke.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'

describe('Test infrastructure', () => {
  it('vitest is working', () => {
    expect(1 + 1).toBe(2)
  })
})
```

**Step 2: Run it**

```bash
pnpm test
```

Expected: PASS

**Step 3: Commit**

```bash
git add test/smoke.test.ts
git commit -m "chore: verify test infrastructure with smoke test"
```

---

## Phase 2: Local Static Analyzer — Array Out-of-Bounds Detection

This is the highest-priority feature. We build a `PineStaticAnalyzer` class that scans Pine Script source text and produces diagnostics for detectable issues — without calling the TradingView API.

### Task 2.1: Write Tests for Array Out-of-Bounds Detection

**Files:**
- Create: `test/PineStaticAnalyzer.test.ts`

**Step 1: Write failing tests covering all detectable patterns**

```typescript
import { describe, it, expect } from 'vitest'
import { PineStaticAnalyzer, AnalyzerDiagnostic } from '../src/PineStaticAnalyzer'

describe('PineStaticAnalyzer', () => {
  function analyze(code: string): AnalyzerDiagnostic[] {
    return new PineStaticAnalyzer(code).analyze()
  }

  describe('array out-of-bounds: literal index on known-size array', () => {
    it('flags array.get with literal index exceeding array.from size', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
v = array.get(a, 5)
`
      const diags = analyze(code)
      expect(diags.length).toBeGreaterThanOrEqual(1)
      expect(diags[0].message).toContain('out of bounds')
      expect(diags[0].severity).toBe('error')
      expect(diags[0].line).toBe(5) // 1-indexed
    })

    it('does not flag valid index on array.from', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
v = array.get(a, 2)
`
      const diags = analyze(code)
      expect(diags.filter(d => d.message.includes('out of bounds'))).toHaveLength(0)
    })

    it('flags negative index exceeding array.from size', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
v = array.get(a, -4)
`
      const diags = analyze(code)
      expect(diags.length).toBeGreaterThanOrEqual(1)
      expect(diags[0].message).toContain('out of bounds')
    })

    it('allows valid negative index', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
v = array.get(a, -1)
`
      const diags = analyze(code)
      expect(diags.filter(d => d.message.includes('out of bounds'))).toHaveLength(0)
    })
  })

  describe('array out-of-bounds: off-by-one with array.size()', () => {
    it('flags array.get(a, array.size(a)) — always off by one', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
v = array.get(a, array.size(a))
`
      const diags = analyze(code)
      expect(diags.length).toBeGreaterThanOrEqual(1)
      expect(diags[0].message).toContain('off by one')
    })

    it('allows array.get(a, array.size(a) - 1)', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
v = array.get(a, array.size(a) - 1)
`
      const diags = analyze(code)
      expect(diags.filter(d => d.message.includes('off by one'))).toHaveLength(0)
    })
  })

  describe('array out-of-bounds: unguarded access warnings', () => {
    it('warns on array.first() without size check', () => {
      const code = `
//@version=6
indicator("test")
a = array.new<float>(0)
v = a.first()
`
      const diags = analyze(code)
      const warnings = diags.filter(d => d.severity === 'warning' && d.message.includes('empty'))
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    it('warns on array.last() without size check', () => {
      const code = `
//@version=6
indicator("test")
a = array.new<float>(0)
v = a.last()
`
      const diags = analyze(code)
      const warnings = diags.filter(d => d.severity === 'warning' && d.message.includes('empty'))
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    it('does not warn when guarded by size check', () => {
      const code = `
//@version=6
indicator("test")
a = array.new<float>(0)
if array.size(a) > 0
    v = a.first()
`
      const diags = analyze(code)
      const warnings = diags.filter(d => d.severity === 'warning' && d.message.includes('empty'))
      expect(warnings).toHaveLength(0)
    })
  })

  describe('array out-of-bounds: loop pattern detection', () => {
    it('warns on for loop with unrelated bound and array.get', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
for i = 0 to 10
    v = array.get(a, i)
`
      const diags = analyze(code)
      const warnings = diags.filter(d => d.severity === 'warning' && d.message.includes('loop'))
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    it('does not warn when loop bound uses array.size', () => {
      const code = `
//@version=6
indicator("test")
a = array.from(1, 2, 3)
for i = 0 to array.size(a) - 1
    v = array.get(a, i)
`
      const diags = analyze(code)
      const warnings = diags.filter(d => d.severity === 'warning' && d.message.includes('loop'))
      expect(warnings).toHaveLength(0)
    })
  })

  describe('v6 type safety: int/float to bool implicit cast removed', () => {
    it('warns on using int variable directly in if condition', () => {
      const code = `
//@version=6
indicator("test")
x = 5
if x
    label.new(bar_index, close, "hi")
`
      const diags = analyze(code)
      const warnings = diags.filter(d => d.message.includes('bool'))
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('only runs on v6 scripts', () => {
    it('returns empty for v5 scripts', () => {
      const code = `
//@version=5
indicator("test")
a = array.from(1, 2, 3)
v = array.get(a, 5)
`
      const diags = analyze(code)
      expect(diags).toHaveLength(0)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test
```

Expected: FAIL — `PineStaticAnalyzer` module doesn't exist yet.

**Step 3: Commit the test file**

```bash
git add test/PineStaticAnalyzer.test.ts
git commit -m "test: add failing tests for PineStaticAnalyzer array out-of-bounds detection"
```

---

### Task 2.2: Implement PineStaticAnalyzer

**Files:**
- Create: `src/PineStaticAnalyzer.ts`

**Step 1: Implement the analyzer**

```typescript
/**
 * PineStaticAnalyzer performs local static analysis on Pine Script v6 source code
 * to detect errors and warnings that the TradingView API doesn't surface,
 * such as array out-of-bounds access patterns.
 *
 * This runs entirely locally — no API calls.
 */

export interface AnalyzerDiagnostic {
  line: number      // 1-indexed line number
  column: number    // 1-indexed column
  endColumn: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface ArrayInfo {
  name: string
  knownSize: number | null  // null if size is dynamic/unknown
  declarationLine: number
}

export class PineStaticAnalyzer {
  private lines: string[]
  private code: string
  private arrays: Map<string, ArrayInfo> = new Map()

  constructor(code: string) {
    this.code = code
    this.lines = code.split('\n')
  }

  /**
   * Run all analysis passes and return diagnostics.
   */
  analyze(): AnalyzerDiagnostic[] {
    if (!this.isV6()) return []

    const diagnostics: AnalyzerDiagnostic[] = []

    // Pass 1: Collect known array declarations
    this.collectArrayDeclarations()

    // Pass 2: Check for array out-of-bounds patterns
    diagnostics.push(...this.checkArrayOutOfBounds())

    // Pass 3: Check for int/float-to-bool implicit cast (removed in v6)
    diagnostics.push(...this.checkImplicitBoolCast())

    return diagnostics
  }

  private isV6(): boolean {
    return /\/\/@version=6/.test(this.code)
  }

  /**
   * Pass 1: Scan for array declarations and track known sizes.
   */
  private collectArrayDeclarations(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]

      // Match: varName = array.from(val1, val2, ...)
      const fromMatch = line.match(
        /(\w+)\s*=\s*array\.from\s*\(([^)]*)\)/
      )
      if (fromMatch) {
        const varName = fromMatch[1]
        const args = fromMatch[2]
        // Count comma-separated arguments
        const size = args.trim() === '' ? 0 : args.split(',').length
        this.arrays.set(varName, {
          name: varName,
          knownSize: size,
          declarationLine: i + 1,
        })
        continue
      }

      // Match: varName = array.new<type>(size)
      const newMatch = line.match(
        /(\w+)\s*=\s*array\.new<[^>]+>\s*\((\d+)/
      )
      if (newMatch) {
        const varName = newMatch[1]
        const size = parseInt(newMatch[2], 10)
        this.arrays.set(varName, {
          name: varName,
          knownSize: size,
          declarationLine: i + 1,
        })
      }
    }
  }

  /**
   * Pass 2: Detect array out-of-bounds access patterns.
   */
  private checkArrayOutOfBounds(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      const lineNum = i + 1

      // Pattern A: array.get(arr, <literal_int>) with known-size array
      diagnostics.push(...this.checkLiteralIndexAccess(line, lineNum))

      // Pattern B: array.get(arr, array.size(arr)) — off by one
      diagnostics.push(...this.checkOffByOneSize(line, lineNum))

      // Pattern C: .first() or .last() on potentially empty array without guard
      diagnostics.push(...this.checkUnguardedFirstLast(line, lineNum, i))

      // Pattern D: Loop with unrelated bound accessing array
      diagnostics.push(...this.checkLoopBounds(line, lineNum, i))
    }

    return diagnostics
  }

  /**
   * Check array.get/set with literal integer index against known array size.
   */
  private checkLiteralIndexAccess(line: string, lineNum: number): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    // Match both array.get(name, index) and name.get(index) syntaxes
    const patterns = [
      /array\.(?:get|set|insert|remove)\s*\(\s*(\w+)\s*,\s*(-?\d+)/g,
      /(\w+)\.(?:get|set|insert|remove)\s*\(\s*(-?\d+)/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(line)) !== null) {
        const arrName = match[1]
        const index = parseInt(match[2], 10)
        const arrayInfo = this.arrays.get(arrName)

        if (arrayInfo && arrayInfo.knownSize !== null) {
          const size = arrayInfo.knownSize
          const isOutOfBounds =
            index >= 0 ? index >= size : Math.abs(index) > size

          if (isOutOfBounds) {
            const col = match.index! + 1
            diagnostics.push({
              line: lineNum,
              column: col,
              endColumn: col + match[0].length,
              message: `Array index ${index} is out of bounds — '${arrName}' has ${size} element(s) (valid indices: 0 to ${size - 1}, or -1 to -${size}).`,
              severity: 'error',
            })
          }
        }
      }
    }

    return diagnostics
  }

  /**
   * Check for array.get(arr, array.size(arr)) — always off by one.
   */
  private checkOffByOneSize(line: string, lineNum: number): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    // Match: array.get(x, array.size(x)) without "- 1" after
    const pattern = /array\.get\s*\(\s*(\w+)\s*,\s*array\.size\s*\(\s*(\w+)\s*\)\s*\)/g
    let match
    while ((match = pattern.exec(line)) !== null) {
      const arrName = match[1]
      const sizeArrName = match[2]

      if (arrName === sizeArrName) {
        // Check that it's NOT followed by "- 1" (which would be correct)
        const afterSize = line.slice(match.index!)
        if (!/array\.size\s*\(\s*\w+\s*\)\s*-\s*1/.test(afterSize)) {
          const col = match.index! + 1
          diagnostics.push({
            line: lineNum,
            column: col,
            endColumn: col + match[0].length,
            message: `Array access off by one — array.get(${arrName}, array.size(${arrName})) will always fail. Use array.size(${arrName}) - 1 for the last element, or use array.last(${arrName}).`,
            severity: 'error',
          })
        }
      }
    }

    // Also check method syntax: x.get(x.size())
    const methodPattern = /(\w+)\.get\s*\(\s*\1\.size\s*\(\s*\)\s*\)/g
    while ((match = methodPattern.exec(line)) !== null) {
      const arrName = match[1]
      const afterSize = line.slice(match.index!)
      if (!/\.size\s*\(\s*\)\s*-\s*1/.test(afterSize)) {
        const col = match.index! + 1
        diagnostics.push({
          line: lineNum,
          column: col,
          endColumn: col + match[0].length,
          message: `Array access off by one — ${arrName}.get(${arrName}.size()) will always fail. Use ${arrName}.size() - 1 or ${arrName}.last().`,
          severity: 'error',
        })
      }
    }

    return diagnostics
  }

  /**
   * Check for .first() or .last() on arrays that could be empty, without a size guard.
   */
  private checkUnguardedFirstLast(
    line: string,
    lineNum: number,
    lineIndex: number,
  ): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    // Match: arr.first() or arr.last() or array.first(arr) or array.last(arr)
    const methodPattern = /(\w+)\.(first|last)\s*\(\s*\)/g
    const funcPattern = /array\.(first|last)\s*\(\s*(\w+)\s*\)/g

    const checkGuard = (arrName: string): boolean => {
      // Look backward up to 5 lines for a size guard
      const lookback = Math.max(0, lineIndex - 5)
      for (let j = lookback; j < lineIndex; j++) {
        const prevLine = this.lines[j]
        if (
          prevLine.includes(`array.size(${arrName})`) ||
          prevLine.includes(`${arrName}.size()`)
        ) {
          return true // Guarded
        }
      }
      // Also check if the guard is on the same line (short-circuit)
      if (
        line.includes(`array.size(${arrName})`) ||
        line.includes(`${arrName}.size()`)
      ) {
        return true
      }
      return false
    }

    let match
    while ((match = methodPattern.exec(line)) !== null) {
      const arrName = match[1]
      const method = match[2]
      // Skip if this isn't a known array or if guarded
      if (!this.arrays.has(arrName)) continue
      const info = this.arrays.get(arrName)!
      // If array is known to have size > 0, skip
      if (info.knownSize !== null && info.knownSize > 0) continue

      if (!checkGuard(arrName)) {
        diagnostics.push({
          line: lineNum,
          column: match.index! + 1,
          endColumn: match.index! + 1 + match[0].length,
          message: `'${arrName}.${method}()' may fail if the array is empty. Guard with '${arrName}.size() > 0' or use 'array.size(${arrName}) > 0' before accessing.`,
          severity: 'warning',
        })
      }
    }

    while ((match = funcPattern.exec(line)) !== null) {
      const method = match[1]
      const arrName = match[2]
      if (!this.arrays.has(arrName)) continue
      const info = this.arrays.get(arrName)!
      if (info.knownSize !== null && info.knownSize > 0) continue

      if (!checkGuard(arrName)) {
        diagnostics.push({
          line: lineNum,
          column: match.index! + 1,
          endColumn: match.index! + 1 + match[0].length,
          message: `'array.${method}(${arrName})' may fail if the array is empty. Guard with 'array.size(${arrName}) > 0' before accessing.`,
          severity: 'warning',
        })
      }
    }

    return diagnostics
  }

  /**
   * Check for loops accessing arrays with bounds not derived from array.size().
   */
  private checkLoopBounds(
    line: string,
    lineNum: number,
    lineIndex: number,
  ): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    // Match: for i = 0 to <something>
    const forMatch = line.match(/for\s+(\w+)\s*=\s*\d+\s+to\s+(.+)/)
    if (!forMatch) return diagnostics

    const loopVar = forMatch[1]
    const boundExpr = forMatch[2].trim()

    // Scan the loop body (indented lines after this) for array access using loopVar
    for (let j = lineIndex + 1; j < this.lines.length; j++) {
      const bodyLine = this.lines[j]

      // Stop at un-indented line (loop body ended)
      if (bodyLine.match(/^\S/) && bodyLine.trim() !== '') break
      if (bodyLine.trim() === '') continue

      // Check if loop body accesses an array with the loop variable
      const accessPatterns = [
        new RegExp(`array\\.get\\s*\\(\\s*(\\w+)\\s*,\\s*${loopVar}\\s*\\)`),
        new RegExp(`(\\w+)\\.get\\s*\\(\\s*${loopVar}\\s*\\)`),
      ]

      for (const accessPattern of accessPatterns) {
        const accessMatch = bodyLine.match(accessPattern)
        if (accessMatch) {
          const arrName = accessMatch[1]
          // Check if the bound expression references this array's size
          const isBoundSafe =
            boundExpr.includes(`array.size(${arrName})`) ||
            boundExpr.includes(`${arrName}.size()`)

          if (!isBoundSafe) {
            diagnostics.push({
              line: lineNum,
              column: forMatch.index! + 1,
              endColumn: forMatch.index! + 1 + forMatch[0].length,
              message: `Loop variable '${loopVar}' is used to index '${arrName}', but the loop bound '${boundExpr}' is not derived from '${arrName}.size()' or 'array.size(${arrName})'. This may cause an array out-of-bounds error at runtime.`,
              severity: 'warning',
            })
          }
        }
      }
    }

    return diagnostics
  }

  /**
   * Pass 3: Detect int/float used directly in boolean context (removed in v6).
   */
  private checkImplicitBoolCast(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    // Track variables declared with numeric types
    const numericVars = new Set<string>()

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]

      // Detect numeric variable declarations
      // Pattern: x = <number>  or  int x = ...  or  float x = ...
      const intDeclMatch = line.match(/(?:int|float)\s+(\w+)\s*=/)
      if (intDeclMatch) {
        numericVars.add(intDeclMatch[1])
        continue
      }
      const numLiteralMatch = line.match(/(\w+)\s*=\s*(-?\d+\.?\d*)\s*$/)
      if (numLiteralMatch) {
        numericVars.add(numLiteralMatch[1])
        continue
      }

      // Check: if <numericVar> (without comparison operator)
      const ifMatch = line.match(/^\s*(if|while)\s+(\w+)\s*$/)
      if (ifMatch) {
        const varName = ifMatch[2]
        if (numericVars.has(varName)) {
          diagnostics.push({
            line: i + 1,
            column: 1,
            endColumn: line.length + 1,
            message: `In Pine Script v6, '${varName}' (int/float) cannot be used directly as a bool. Use '${varName} != 0' instead.`,
            severity: 'warning',
          })
        }
      }
    }

    return diagnostics
  }
}
```

**Step 2: Run tests**

```bash
pnpm test
```

Expected: All tests in `PineStaticAnalyzer.test.ts` PASS.

**Step 3: Commit**

```bash
git add src/PineStaticAnalyzer.ts
git commit -m "feat: add PineStaticAnalyzer with array out-of-bounds detection and v6 type safety checks"
```

---

### Task 2.3: Integrate Static Analyzer into PineLint Pipeline

**Files:**
- Modify: `src/PineLint.ts:80-102` (lintDocument method)

**Step 1: Write integration test**

Create `test/PineLint.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PineStaticAnalyzer } from '../src/PineStaticAnalyzer'

describe('PineStaticAnalyzer integration scenarios', () => {
  it('produces diagnostics for real-world array out-of-bounds pattern', () => {
    const code = `//@version=6
indicator("My Script")
var prices = array.from(close, close, close)
lastPrice = array.get(prices, 5)
plot(lastPrice)
`
    const analyzer = new PineStaticAnalyzer(code)
    const diags = analyzer.analyze()
    expect(diags.some(d => d.message.includes('out of bounds'))).toBe(true)
  })

  it('handles complex real-world script without false positives', () => {
    const code = `//@version=6
indicator("Safe Script")
var prices = array.new<float>(0)
if barstate.islast
    prices.push(close)
    if prices.size() > 0
        lastPrice = prices.last()
        plot(lastPrice)
`
    const analyzer = new PineStaticAnalyzer(code)
    const diags = analyzer.analyze()
    expect(diags).toHaveLength(0)
  })
})
```

**Step 2: Run test**

```bash
pnpm test
```

Expected: PASS

**Step 3: Add static analyzer call to PineLint.lintDocument**

In `src/PineLint.ts`, add the import at top:

```typescript
import { PineStaticAnalyzer } from './PineStaticAnalyzer'
```

Modify the `lintDocument` method to also run local analysis:

```typescript
static async lintDocument(): Promise<void> {
  if (VSCode.ActivePineFile && !PineLint.initialFlag && (await PineLint.checkVersion())) {
    // Run local static analysis (instant, no API call)
    const docText = VSCode.Text ?? ''
    if (docText) {
      const analyzer = new PineStaticAnalyzer(docText)
      const localDiags = analyzer.analyze()
      PineLint.applyLocalDiagnostics(localDiags)
    }

    // Run remote lint (async, calls TradingView API)
    const response = await Class.PineRequest.lint()
    if (response) {
      PineLint.handleResponse(response)
      PineLint.format(response)
    }
  }
}
```

Add the new helper method to `PineLint`:

```typescript
static applyLocalDiagnostics(localDiags: import('./PineStaticAnalyzer').AnalyzerDiagnostic[]): void {
  if (localDiags.length === 0) return

  const vsDiags = localDiags.map(d => {
    const range = new vscode.Range(d.line - 1, d.column - 1, d.line - 1, d.endColumn - 1)
    const severity = d.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : d.severity === 'warning'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information
    const diag = new vscode.Diagnostic(range, d.message, severity)
    diag.source = 'pine-static-analyzer'
    return diag
  })

  // Merge with existing diagnostics
  const uri = VSCode.Uri
  if (uri) {
    const existing = PineLint.diagnostics ?? []
    PineLint.setDiagnostics(uri, [...vsDiags, ...existing])
  }
}
```

**Step 4: Compile and verify**

```bash
pnpm run compile
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/PineLint.ts test/PineLint.integration.test.ts
git commit -m "feat: integrate PineStaticAnalyzer into lint pipeline for instant local diagnostics"
```

---

## Phase 3: Update pineDocs.json with Missing v6 Features

### Task 3.1: Add Enum Type Support to pineDocs.json

**Files:**
- Modify: `Pine_Script_Documentation/pineDocs.json`

**Step 1: Write test for enum presence in docs**

Create `test/PineDocsManager.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('pineDocs.json v6 completeness', () => {
  let docs: any

  beforeAll(() => {
    const docsPath = path.join(__dirname, '..', 'Pine_Script_Documentation', 'pineDocs.json')
    docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'))
  })

  // Helper to find a doc by name in any category
  function findDoc(name: string, category: string): any {
    const categoryDocs = docs[category]?.[0]?.docs ?? []
    return categoryDocs.find((d: any) => d.name === name)
  }

  function findInAny(name: string): any {
    for (const key of Object.keys(docs)) {
      const found = findDoc(name, key)
      if (found) return found
    }
    return null
  }

  describe('v6 keywords and types', () => {
    it('has enum keyword in controls', () => {
      expect(findDoc('enum', 'controls')).toBeTruthy()
    })
  })

  describe('v6 built-in functions', () => {
    it('has log.info', () => {
      expect(findInAny('log.info')).toBeTruthy()
    })
    it('has log.warning', () => {
      expect(findInAny('log.warning')).toBeTruthy()
    })
    it('has log.error', () => {
      expect(findInAny('log.error')).toBeTruthy()
    })
    it('has request.footprint', () => {
      expect(findInAny('request.footprint')).toBeTruthy()
    })
  })

  describe('v6 built-in variables', () => {
    it('has bid variable', () => {
      expect(findInAny('bid')).toBeTruthy()
    })
    it('has ask variable', () => {
      expect(findInAny('ask')).toBeTruthy()
    })
    it('has strategy.closedtrades.first_index', () => {
      expect(findInAny('strategy.closedtrades.first_index')).toBeTruthy()
    })
  })

  describe('v6 constants', () => {
    it('has text.format_bold', () => {
      expect(findInAny('text.format_bold')).toBeTruthy()
    })
    it('has text.format_italic', () => {
      expect(findInAny('text.format_italic')).toBeTruthy()
    })
    it('has plot.linestyle_solid', () => {
      expect(findInAny('plot.linestyle_solid')).toBeTruthy()
    })
    it('has plot.linestyle_dashed', () => {
      expect(findInAny('plot.linestyle_dashed')).toBeTruthy()
    })
    it('has plot.linestyle_dotted', () => {
      expect(findInAny('plot.linestyle_dotted')).toBeTruthy()
    })
  })

  describe('v6 types', () => {
    it('has footprint type', () => {
      expect(findDoc('footprint', 'types')).toBeTruthy()
    })
    it('has volume_row type', () => {
      expect(findDoc('volume_row', 'types')).toBeTruthy()
    })
  })

  describe('v6 annotations', () => {
    it('has @enum annotation', () => {
      expect(findDoc('@enum', 'annotations') || findDoc('enum', 'annotations')).toBeTruthy()
    })
  })
})
```

**Step 2: Run tests to see what fails**

```bash
pnpm test -- test/PineDocsManager.test.ts
```

Expected: Most v6-specific tests FAIL (docs not yet updated).

**Step 3: Update pineDocs.json**

Add the missing entries to the appropriate categories. This is a data-entry task — add JSON objects following the existing format in each category array.

**Controls** — add `enum` keyword:
```json
{
  "name": "enum",
  "kind": "Keyword",
  "desc": "Declares an enumeration type. Enum fields are const values of a unique type. Members are referenced as EnumName.field_name.",
  "syntax": "enum EnumName\n    field_name1\n    field_name2 = \"Display Title\"",
  "remarks": "Enum types can be exported from libraries with 'export enum'. Enum members can be used as map keys."
}
```

**Functions** — add `log.info`, `log.warning`, `log.error`, `request.footprint`:
```json
{
  "name": "log.info",
  "kind": "Function",
  "desc": "Logs an informational message to the Pine Logs pane (gray text).",
  "syntax": "log.info(message) → void",
  "args": [{ "name": "message", "type": "string", "desc": "The message to log.", "required": true }],
  "returns": "void"
},
{
  "name": "log.warning",
  "kind": "Function",
  "desc": "Logs a warning message to the Pine Logs pane (orange text).",
  "syntax": "log.warning(message) → void",
  "args": [{ "name": "message", "type": "string", "desc": "The message to log.", "required": true }],
  "returns": "void"
},
{
  "name": "log.error",
  "kind": "Function",
  "desc": "Logs an error message to the Pine Logs pane (red text).",
  "syntax": "log.error(message) → void",
  "args": [{ "name": "message", "type": "string", "desc": "The message to log.", "required": true }],
  "returns": "void"
},
{
  "name": "request.footprint",
  "kind": "Function",
  "desc": "Requests volume footprint data for the current bar. Returns a footprint object with buy/sell volume, delta, and price levels. Requires Premium or Ultimate TradingView plan.",
  "syntax": "request.footprint(type, rows) → footprint",
  "args": [
    { "name": "type", "type": "string", "desc": "The type of footprint data.", "required": true },
    { "name": "rows", "type": "int", "desc": "The number of price rows.", "required": false }
  ],
  "returns": "footprint"
}
```

**Variables** — add `bid`, `ask`, `strategy.closedtrades.first_index`:
```json
{
  "name": "bid",
  "kind": "Variable",
  "desc": "The highest active buyer price. Only available on the 1T (tick) timeframe.",
  "syntax": "bid",
  "returns": "float"
},
{
  "name": "ask",
  "kind": "Variable",
  "desc": "The lowest active seller price. Only available on the 1T (tick) timeframe.",
  "syntax": "ask",
  "returns": "float"
},
{
  "name": "strategy.closedtrades.first_index",
  "kind": "Variable",
  "desc": "The index of the earliest remaining closed trade after auto-trimming. Returns 0 before any trimming occurs.",
  "syntax": "strategy.closedtrades.first_index",
  "returns": "int"
}
```

**Constants** — add text formatting and plot linestyle:
```json
{
  "name": "text.format_bold",
  "kind": "Constant",
  "desc": "Bold text formatting constant for labels and tables.",
  "syntax": "text.format_bold",
  "returns": "string"
},
{
  "name": "text.format_italic",
  "kind": "Constant",
  "desc": "Italic text formatting constant for labels and tables.",
  "syntax": "text.format_italic",
  "returns": "string"
},
{
  "name": "plot.linestyle_solid",
  "kind": "Constant",
  "desc": "Solid line style for plot().",
  "syntax": "plot.linestyle_solid",
  "returns": "int"
},
{
  "name": "plot.linestyle_dashed",
  "kind": "Constant",
  "desc": "Dashed line style for plot().",
  "syntax": "plot.linestyle_dashed",
  "returns": "int"
},
{
  "name": "plot.linestyle_dotted",
  "kind": "Constant",
  "desc": "Dotted line style for plot().",
  "syntax": "plot.linestyle_dotted",
  "returns": "int"
}
```

**Types** — add `footprint` and `volume_row`:
```json
{
  "name": "footprint",
  "kind": "Type",
  "desc": "Volume footprint data for a bar. Contains buy volume, sell volume, delta, POC, VAH, and VAL.",
  "syntax": "footprint"
},
{
  "name": "volume_row",
  "kind": "Type",
  "desc": "Individual price-level row within a footprint, containing volume data at a specific price.",
  "syntax": "volume_row"
}
```

**Annotations** — add `@enum`:
```json
{
  "name": "@enum",
  "kind": "Annotation",
  "desc": "Documents an enum type definition in a library.",
  "syntax": "// @enum EnumName Description of the enum"
}
```

**Step 4: Run tests again**

```bash
pnpm test -- test/PineDocsManager.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add Pine_Script_Documentation/pineDocs.json test/PineDocsManager.test.ts
git commit -m "feat: update pineDocs.json with missing v6 types, functions, variables, and constants"
```

---

### Task 3.2: Add Enum Parsing Support to PineParser

**Files:**
- Modify: `src/PineParser.ts`
- Create: `test/PineParser.test.ts`

**Step 1: Write failing tests for enum parsing**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { PineParser } from '../src/PineParser'

// Mock the dependencies
vi.mock('../src/index', () => ({
  Class: {
    PineDocsManager: { setParsed: vi.fn() },
    PineRequest: { libList: vi.fn(), getScript: vi.fn() },
  },
}))
vi.mock('../src/PineHelpers', () => ({
  Helpers: { checkDocsMatch: vi.fn() },
}))
vi.mock('../src/VSCode', () => ({
  VSCode: { Text: '' },
}))

describe('PineParser', () => {
  let parser: PineParser

  beforeEach(() => {
    parser = new PineParser()
  })

  describe('enum parsing', () => {
    it('parses a basic enum declaration', () => {
      const script = `
//@version=6
indicator("test")

enum Direction
    long
    short
    flat
`
      const result = parser.parseEnums([{ script }])
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Direction')
      expect(result[0].fields).toHaveLength(3)
      expect(result[0].fields[0].name).toBe('long')
      expect(result[0].fields[1].name).toBe('short')
      expect(result[0].fields[2].name).toBe('flat')
    })

    it('parses enum with string titles', () => {
      const script = `
//@version=6
indicator("test")

enum Signal
    buy = "Buy Signal"
    sell = "Sell Signal"
`
      const result = parser.parseEnums([{ script }])
      expect(result).toHaveLength(1)
      expect(result[0].fields[0].title).toBe('Buy Signal')
    })

    it('parses exported enum', () => {
      const script = `
//@version=6
library("mylib")

export enum Color
    red
    green
    blue
`
      const result = parser.parseEnums([{ script }])
      expect(result).toHaveLength(1)
      expect(result[0].exported).toBe(true)
    })
  })
})
```

**Step 2: Run tests to verify failure**

```bash
pnpm test -- test/PineParser.test.ts
```

Expected: FAIL — `parseEnums` method doesn't exist.

**Step 3: Add enum parsing to PineParser**

Add to `src/PineParser.ts`:

```typescript
// Add new regex after existing patterns
enumPattern: RegExp =
  /(?<exportKeyword>export)?\s*enum\s+(?<enumName>\w+)\n(?<fieldsBlock>(?:\s+[^\n]+\n?)+)/gm

enumFieldPattern: RegExp =
  /^\s+(?<fieldName>\w+)(?:\s*=\s*"(?<fieldTitle>[^"]*)")?/gm

/**
 * Parses enum declarations from the provided documents.
 */
parseEnums(documents: any[]): any[] {
  const parsedEnums: any[] = []

  for (const doc of documents) {
    const { script, alias } = doc
    if (typeof script !== 'string') continue

    const enumMatches = script.matchAll(this.enumPattern)

    for (const enumMatch of enumMatches) {
      const { exportKeyword, enumName, fieldsBlock } = enumMatch.groups!

      const name = (alias ? alias + '.' : '') + enumName
      const enumBuild: any = {
        name,
        originalName: enumName,
        kind: 'Enum',
        fields: [],
        exported: !!exportKeyword,
      }

      if (fieldsBlock) {
        const fieldMatches = fieldsBlock.matchAll(this.enumFieldPattern)
        for (const fieldMatch of fieldMatches) {
          const { fieldName, fieldTitle } = fieldMatch.groups!
          const field: any = { name: fieldName }
          if (fieldTitle) field.title = fieldTitle
          enumBuild.fields.push(field)
        }
      }
      parsedEnums.push(enumBuild)
    }
  }
  return parsedEnums
}
```

Also call `parseEnums` from `callDocParser`:

```typescript
callDocParser(documents: any[]) {
  if (!Array.isArray(documents) || documents.length === 0) return
  this.parseFunctions(documents)
  this.parseTypes(documents)
  this.parseEnums(documents) // Add this line
}
```

**Step 4: Run tests**

```bash
pnpm test -- test/PineParser.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/PineParser.ts test/PineParser.test.ts
git commit -m "feat: add enum declaration parsing to PineParser"
```

---

## Phase 4: Comprehensive Test Suite

### Task 4.1: Static Analyzer — Extended Edge Cases

**Files:**
- Create: `test/PineStaticAnalyzer.edge-cases.test.ts`

**Step 1: Write edge case tests**

```typescript
import { describe, it, expect } from 'vitest'
import { PineStaticAnalyzer } from '../src/PineStaticAnalyzer'

describe('PineStaticAnalyzer edge cases', () => {
  function analyze(code: string) {
    return new PineStaticAnalyzer(code).analyze()
  }

  it('handles method syntax: arr.get(index)', () => {
    const code = `//@version=6
indicator("test")
a = array.from(1, 2, 3)
v = a.get(10)
`
    const diags = analyze(code)
    expect(diags.some(d => d.message.includes('out of bounds'))).toBe(true)
  })

  it('handles array.set with out-of-bounds literal', () => {
    const code = `//@version=6
indicator("test")
a = array.from(1, 2, 3)
array.set(a, 5, 99)
`
    const diags = analyze(code)
    expect(diags.some(d => d.message.includes('out of bounds'))).toBe(true)
  })

  it('handles multiple arrays independently', () => {
    const code = `//@version=6
indicator("test")
small = array.from(1)
big = array.from(1, 2, 3, 4, 5)
v1 = array.get(small, 0)
v2 = array.get(big, 4)
`
    const diags = analyze(code)
    expect(diags).toHaveLength(0)
  })

  it('handles empty script gracefully', () => {
    const diags = analyze('')
    expect(diags).toHaveLength(0)
  })

  it('handles script with no arrays', () => {
    const code = `//@version=6
indicator("test")
plot(close)
`
    const diags = analyze(code)
    expect(diags).toHaveLength(0)
  })

  it('handles array.new with zero size followed by first()', () => {
    const code = `//@version=6
indicator("test")
a = array.new<float>(0)
v = array.first(a)
`
    const diags = analyze(code)
    expect(diags.some(d => d.severity === 'warning')).toBe(true)
  })

  it('does not false-positive on non-array variables named similarly', () => {
    const code = `//@version=6
indicator("test")
a = 5
b = a.get(10)
`
    // 'a' is not an array, so no diagnostic
    const diags = analyze(code)
    expect(diags.filter(d => d.message.includes('out of bounds'))).toHaveLength(0)
  })

  it('handles array.from with single element', () => {
    const code = `//@version=6
indicator("test")
a = array.from(42)
v = array.get(a, 1)
`
    const diags = analyze(code)
    expect(diags.some(d => d.message.includes('out of bounds'))).toBe(true)
  })

  it('handles for...in loop (should not warn)', () => {
    const code = `//@version=6
indicator("test")
a = array.from(1, 2, 3)
for val in a
    log.info(str.tostring(val))
`
    const diags = analyze(code)
    expect(diags.filter(d => d.message.includes('loop'))).toHaveLength(0)
  })
})
```

**Step 2: Run and fix any failures**

```bash
pnpm test -- test/PineStaticAnalyzer.edge-cases.test.ts
```

**Step 3: Commit**

```bash
git add test/PineStaticAnalyzer.edge-cases.test.ts
git commit -m "test: add edge case tests for PineStaticAnalyzer"
```

---

### Task 4.2: PineDocsManager Unit Tests

**Files:**
- Extend: `test/PineDocsManager.test.ts`

**Step 1: Add unit tests for getMap, mergeDocs, setParsed**

```typescript
// Add to existing test/PineDocsManager.test.ts

describe('PineDocsManager unit tests', () => {
  // These test the class methods directly by loading the real pineDocs.json
  let docsManager: any

  beforeAll(async () => {
    // Dynamic import to avoid vscode dependency issues
    const mod = await import('../src/PineDocsManager')
    docsManager = new mod.PineDocsManager()
  })

  it('getMap returns a Map with string keys', () => {
    const map = docsManager.getMap('functions')
    expect(map).toBeInstanceOf(Map)
    expect(map.size).toBeGreaterThan(0)
  })

  it('getMap contains known functions like ta.sma', () => {
    const map = docsManager.getMap('functions')
    expect(map.has('ta.sma')).toBe(true)
  })

  it('getDocs merges multiple categories', () => {
    const docs = docsManager.getDocs('functions', 'variables')
    expect(docs.length).toBeGreaterThan(docsManager.getFunctions().length)
  })

  it('cleanDocs resets dynamic doc arrays', () => {
    docsManager.setSwitch('UDT', [{ name: 'test' }])
    expect(docsManager.getUDT().length).toBe(1)
    docsManager.cleanDocs()
    expect(docsManager.getUDT().length).toBe(0)
  })
})
```

**Step 2: Run tests**

```bash
pnpm test -- test/PineDocsManager.test.ts
```

**Step 3: Commit**

```bash
git add test/PineDocsManager.test.ts
git commit -m "test: add PineDocsManager unit tests"
```

---

### Task 4.3: End-to-End Test Pine Script Files

**Files:**
- Create: `test/fixtures/v6-array-oob.pine`
- Create: `test/fixtures/v6-enum.pine`
- Create: `test/fixtures/v6-all-features.pine`
- Create: `test/e2e-fixtures.test.ts`

**Step 1: Create test fixture files**

`test/fixtures/v6-array-oob.pine`:
```pine
//@version=6
indicator("Array OOB Tests")

// Should flag: literal index out of bounds
a = array.from(1, 2, 3)
bad = array.get(a, 5)

// Should flag: off by one
bad2 = array.get(a, array.size(a))

// Should NOT flag: valid access
good = array.get(a, 2)
good2 = array.get(a, array.size(a) - 1)
good3 = array.get(a, -1)

// Should flag: negative out of bounds
bad3 = array.get(a, -4)

// Should warn: unguarded first on empty
b = array.new<float>(0)
bad4 = b.first()

// Should NOT warn: guarded first
if b.size() > 0
    good4 = b.first()

// Should warn: loop with unrelated bound
for i = 0 to 10
    v = array.get(a, i)

// Should NOT warn: loop with array.size bound
for i = 0 to array.size(a) - 1
    v = array.get(a, i)
```

`test/fixtures/v6-enum.pine`:
```pine
//@version=6
indicator("Enum Test")

enum Direction
    long
    short
    flat

enum Signal
    buy = "Buy"
    sell = "Sell"
    hold = "Hold"

var dir = Direction.long

if ta.crossover(ta.sma(close, 10), ta.sma(close, 20))
    dir := Direction.long
else if ta.crossunder(ta.sma(close, 10), ta.sma(close, 20))
    dir := Direction.short

plotchar(dir == Direction.long, "Long", "▲", location.belowbar, color.green)
plotchar(dir == Direction.short, "Short", "▼", location.abovebar, color.red)
```

`test/fixtures/v6-all-features.pine`:
```pine
//@version=6
indicator("V6 All Features", overlay=true)

// Dynamic requests
symbols = array.from("AAPL", "MSFT", "GOOGL")
for sym in symbols
    c = request.security(sym, timeframe.period, close)

// Enhanced text
if barstate.islast
    lbl = label.new(bar_index, high, "Test", text_size=16, text_formatting=text.format_bold)

// Boolean short-circuit
a = array.new<float>(0)
if a.size() > 0 and a.first() > 0
    log.info("safe access")

// Negative array indices
prices = array.from(1.0, 2.0, 3.0)
lastPrice = prices.get(-1)

// Logging
log.info("Script loaded")
log.warning("This is a warning")
log.error("This is an error")

// Enum
enum Trend
    up
    down
    sideways

var trend = Trend.sideways

// Plot with linestyle
plot(close, linestyle=plot.linestyle_dashed)
```

**Step 2: Write fixture-based tests**

`test/e2e-fixtures.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { PineStaticAnalyzer } from '../src/PineStaticAnalyzer'

describe('End-to-end fixture tests', () => {
  function analyzeFixture(name: string) {
    const fixturePath = path.join(__dirname, 'fixtures', name)
    const code = fs.readFileSync(fixturePath, 'utf-8')
    return new PineStaticAnalyzer(code).analyze()
  }

  describe('v6-array-oob.pine', () => {
    it('produces expected diagnostics', () => {
      const diags = analyzeFixture('v6-array-oob.pine')

      // Should have errors for: get(a,5), get(a,array.size(a)), get(a,-4)
      const errors = diags.filter(d => d.severity === 'error')
      expect(errors.length).toBeGreaterThanOrEqual(3)

      // Should have warnings for: unguarded first, loop with unrelated bound
      const warnings = diags.filter(d => d.severity === 'warning')
      expect(warnings.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('v6-all-features.pine', () => {
    it('produces no false positive diagnostics', () => {
      const diags = analyzeFixture('v6-all-features.pine')
      // This script is correct — should have zero errors
      const errors = diags.filter(d => d.severity === 'error')
      expect(errors).toHaveLength(0)
    })
  })
})
```

**Step 3: Run tests**

```bash
pnpm test
```

**Step 4: Commit**

```bash
git add test/fixtures/ test/e2e-fixtures.test.ts
git commit -m "test: add e2e fixture tests for v6 features and array out-of-bounds detection"
```

---

## Phase 5: Grammar and Completion Updates

### Task 5.1: Update TextMate Grammar for New v6 Constants

**Files:**
- Modify: `syntaxes/pine.tmLanguage.json`
- Create: `test/grammar.test.ts`

**Step 1: Write test**

```typescript
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('TextMate Grammar v6 coverage', () => {
  let grammar: any

  beforeAll(() => {
    const grammarPath = path.join(__dirname, '..', 'syntaxes', 'pine.tmLanguage.json')
    grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'))
  })

  function grammarContainsPattern(searchStr: string): boolean {
    const json = JSON.stringify(grammar)
    return json.includes(searchStr)
  }

  it('includes enum keyword', () => {
    expect(grammarContainsPattern('enum')).toBe(true)
  })

  it('includes log namespace', () => {
    expect(grammarContainsPattern('log')).toBe(true)
  })

  it('includes text.format constants', () => {
    expect(grammarContainsPattern('text')).toBe(true)
  })

  it('includes plot.linestyle constants', () => {
    // Check if plot namespace patterns exist
    expect(grammarContainsPattern('plot')).toBe(true)
  })
})
```

**Step 2: Verify grammar includes v6 keywords, add any missing ones**

Check the existing grammar file for `enum`, `log`, `footprint`, `volume_row`, `bid`, `ask`. Add missing entries to the appropriate pattern sections.

**Step 3: Commit**

```bash
git add syntaxes/pine.tmLanguage.json test/grammar.test.ts
git commit -m "feat: update TextMate grammar with missing v6 keywords and namespaces"
```

---

### Task 5.2: Add Enum Completions to PineCompletionProvider

**Files:**
- Modify: `src/PineCompletionProvider.ts`

**Step 1: Add enum member completions**

When a user types `EnumName.`, provide completion items for each enum field. This requires checking the parsed enums from `PineParser` and offering field completions.

Look at how method completions work in the existing `methodCompletions` method and mirror that pattern for enum members. The key integration point is in the dot-trigger completion handler.

**Step 2: Compile and manual-test**

```bash
pnpm run compile
```

**Step 3: Commit**

```bash
git add src/PineCompletionProvider.ts
git commit -m "feat: add enum member completions for EnumName. trigger"
```

---

## Phase 6: Stress Testing and Final Validation

### Task 6.1: Stress Test with Large Scripts

**Files:**
- Create: `test/stress.test.ts`

**Step 1: Write stress tests**

```typescript
import { describe, it, expect } from 'vitest'
import { PineStaticAnalyzer } from '../src/PineStaticAnalyzer'

describe('Stress tests', () => {
  it('handles a 1000-line script without hanging', () => {
    let code = `//@version=6\nindicator("stress")\n`
    for (let i = 0; i < 500; i++) {
      code += `a${i} = array.from(${i}, ${i + 1}, ${i + 2})\n`
      code += `v${i} = array.get(a${i}, 0)\n`
    }
    const start = Date.now()
    const diags = new PineStaticAnalyzer(code).analyze()
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000) // Under 2 seconds
    expect(diags.filter(d => d.severity === 'error')).toHaveLength(0)
  })

  it('handles a script with many errors', () => {
    let code = `//@version=6\nindicator("stress")\n`
    code += `a = array.from(1)\n`
    for (let i = 0; i < 100; i++) {
      code += `v${i} = array.get(a, ${i + 10})\n`
    }
    const diags = new PineStaticAnalyzer(code).analyze()
    expect(diags.filter(d => d.severity === 'error').length).toBe(100)
  })

  it('handles empty arrays and edge cases', () => {
    const code = `//@version=6
indicator("edge")
a = array.new<int>(0)
b = array.from()
`
    const diags = new PineStaticAnalyzer(code).analyze()
    // Should not crash
    expect(diags).toBeDefined()
  })
})
```

**Step 2: Run tests**

```bash
pnpm test -- test/stress.test.ts
```

**Step 3: Commit**

```bash
git add test/stress.test.ts
git commit -m "test: add stress tests for static analyzer performance"
```

---

### Task 6.2: Run Full Test Suite and Coverage

**Step 1: Run all tests with coverage**

```bash
pnpm test:coverage
```

Expected: All tests PASS. Coverage report generated.

**Step 2: Review coverage, identify any gaps**

Check coverage report for uncovered branches in `PineStaticAnalyzer.ts`. Add tests for any uncovered paths.

**Step 3: Final compile check**

```bash
pnpm run compile
```

Expected: Clean build, no errors.

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final coverage improvements and cleanup"
```

---

## Summary of Deliverables

| Phase | What | Files |
|-------|------|-------|
| 1 | Test infrastructure (Vitest + mocks) | `vitest.config.ts`, `test/__mocks__/vscode.ts`, `test/smoke.test.ts` |
| 2 | **PineStaticAnalyzer** — array OOB detection, off-by-one, unguarded access, loop bounds, int→bool cast | `src/PineStaticAnalyzer.ts`, integrated into `src/PineLint.ts` |
| 3 | pineDocs.json v6 update + enum parser | `Pine_Script_Documentation/pineDocs.json`, `src/PineParser.ts` |
| 4 | Comprehensive test suite | `test/PineStaticAnalyzer.test.ts`, `test/PineStaticAnalyzer.edge-cases.test.ts`, `test/PineDocsManager.test.ts`, `test/e2e-fixtures.test.ts`, `test/fixtures/*.pine` |
| 5 | Grammar + completion updates | `syntaxes/pine.tmLanguage.json`, `src/PineCompletionProvider.ts` |
| 6 | Stress tests + coverage | `test/stress.test.ts` |
