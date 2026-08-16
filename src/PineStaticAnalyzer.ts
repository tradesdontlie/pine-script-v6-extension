import { looksLikeSeriesExpression } from './PineQualifierInference'

export interface AnalyzerDiagnostic {
  line: number       // 1-indexed
  column: number     // 1-indexed
  endColumn: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface ArrayInfo {
  name: string
  size: number | null  // null = unknown size
  line: number
}

export class PineStaticAnalyzer {
  private code: string
  private lines: string[]
  private arrays: Map<string, ArrayInfo> = new Map()
  /**
   * Optional name -> doc map (e.g. Class.PineDocsManager.getMap('functions',
   * 'completionFunctions')) used only by checkQualifierMismatch(). Passed in
   * explicitly rather than imported so this class stays dependency-free and
   * trivially testable — the qualifier check simply no-ops when omitted.
   */
  private docsMap?: Map<string, any>

  constructor(code: string, docsMap?: Map<string, any>) {
    this.code = code
    this.lines = code.split('\n')
    this.docsMap = docsMap
  }

  analyze(): AnalyzerDiagnostic[] {
    if (!this.isV6()) {return []}

    const diagnostics: AnalyzerDiagnostic[] = []

    this.collectArrayDeclarations()
    diagnostics.push(...this.checkOOB())
    diagnostics.push(...this.checkUnguardedFirstLast())
    diagnostics.push(...this.checkLoopBounds())
    diagnostics.push(...this.checkImplicitBoolCast())
    diagnostics.push(...this.checkRepaintRisk())
    diagnostics.push(...this.checkDrawingObjectLeaks())
    diagnostics.push(...this.checkNaInTernary())
    diagnostics.push(...this.checkPerformanceLoops())
    diagnostics.push(...this.checkComplexity())
    if (this.docsMap) {
      diagnostics.push(...this.checkQualifierMismatch())
    }

    return diagnostics
  }

  private isV6(): boolean {
    for (const line of this.lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('//@version=6')) {return true}
      if (trimmed.startsWith('//@version=')) {return false}
      // Skip blank lines and comments at top
      if (trimmed === '' || trimmed.startsWith('//')) {continue}
      break
    }
    return false
  }

  private collectArrayDeclarations(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]

      // array.from(1,2,3) — count args
      const fromMatch = line.match(/(\w+)\s*=\s*array\.from\(([^)]*)\)/)
      if (fromMatch) {
        const name = fromMatch[1].trim()
        const args = fromMatch[2].trim()
        const size = args === '' ? 0 : args.split(',').length
        this.arrays.set(name, { name, size, line: i + 1 })
        continue
      }

      // array.new<type>(N) or array.new_float(N) etc
      const newMatch = line.match(/(\w+)\s*=\s*array\.new(?:<\w+>|_\w+)\((\d+)?/)
      if (newMatch) {
        const name = newMatch[1].trim()
        const size = newMatch[2] !== undefined ? parseInt(newMatch[2], 10) : null
        this.arrays.set(name, { name, size, line: i + 1 })
      }
    }
  }

  private checkOOB(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]

      // Function syntax: array.get(a, idx), array.set(a, idx, val)
      const funcPatterns = [
        /array\.(get|set)\(\s*(\w+)\s*,\s*(-?\d+)/g,
      ]

      for (const pattern of funcPatterns) {
        let match
        while ((match = pattern.exec(line)) !== null) {
          const arrName = match[2]
          const idx = parseInt(match[3], 10)
          const info = this.arrays.get(arrName)
          if (!info || info.size === null) {continue}

          const col = match.index + 1
          const endCol = col + match[0].length
          const diag = this.checkIndexBounds(info, idx, i + 1, col, endCol)
          if (diag) {diagnostics.push(diag)}
        }
      }

      // Off-by-one: array.get(a, array.size(a)) or array.set(a, array.size(a), ...)
      // But NOT array.get(a, array.size(a) - 1) which is valid
      const sizeOffByOneFunc = /array\.(get|set)\(\s*(\w+)\s*,\s*array\.size\(\s*(\w+)\s*\)/g
      let match
      while ((match = sizeOffByOneFunc.exec(line)) !== null) {
        const method = match[1]
        const arrName = match[2]
        const sizeArrName = match[3]
        if (arrName === sizeArrName) {
          // Check what follows — if "- 1" comes next, it's valid
          const afterMatch = line.slice(match.index + match[0].length)
          if (/^\s*-\s*1/.test(afterMatch)) {continue}

          diagnostics.push({
            line: i + 1,
            column: match.index + 1,
            endColumn: match.index + 1 + match[0].length,
            message: `Off-by-one: array.${method}(${arrName}, array.size(${arrName})) uses size as index. Use array.size(${arrName}) - 1 for the last element.`,
            severity: 'error',
          })
        }
      }

      // Method syntax: a.get(idx), a.set(idx, val)
      const methodPattern = /(\w+)\.(get|set)\(\s*(-?\d+)/g
      while ((match = methodPattern.exec(line)) !== null) {
        const arrName = match[1]
        const idx = parseInt(match[3], 10)
        // Skip if this looks like array.get (function syntax already handled above)
        if (arrName === 'array') {continue}
        const info = this.arrays.get(arrName)
        if (!info || info.size === null) {continue}

        const col = match.index + 1
        const endCol = col + match[0].length
        const diag = this.checkIndexBounds(info, idx, i + 1, col, endCol)
        if (diag) {diagnostics.push(diag)}
      }

      // Method syntax off-by-one: a.get(a.size())
      const sizeOffByOneMethod = /(\w+)\.(get|set)\(\s*(\w+)\.size\(\)\s*[,)]/g
      while ((match = sizeOffByOneMethod.exec(line)) !== null) {
        const arrName = match[1]
        const method = match[2]
        const sizeObj = match[3]
        if (arrName === 'array') {continue}
        if (arrName === sizeObj && this.arrays.has(arrName)) {
          diagnostics.push({
            line: i + 1,
            column: match.index + 1,
            endColumn: match.index + 1 + match[0].length,
            message: `Off-by-one: ${arrName}.${method}(${arrName}.size()) uses size as index. Use ${arrName}.size() - 1 for the last element.`,
            severity: 'error',
          })
        }
      }
    }

    return diagnostics
  }

  private checkIndexBounds(
    info: ArrayInfo,
    idx: number,
    line: number,
    col: number,
    endCol: number,
  ): AnalyzerDiagnostic | null {
    if (info.size === null) {return null}

    if (idx < 0 && Math.abs(idx) > info.size) {
      return {
        line,
        column: col,
        endColumn: endCol,
        message: `Negative index ${idx} out of bounds for array '${info.name}' of size ${info.size}.`,
        severity: 'error',
      }
    }

    if (idx >= 0 && idx >= info.size) {
      return {
        line,
        column: col,
        endColumn: endCol,
        message: `Index ${idx} out of bounds for array '${info.name}' of size ${info.size}.`,
        severity: 'error',
      }
    }

    return null
  }

  private checkUnguardedFirstLast(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      // Match both array.first(a) / array.last(a) and a.first() / a.last()
      const funcPattern = /array\.(first|last)\(\s*(\w+)\s*\)/g
      const methodPattern = /(\w+)\.(first|last)\(\s*\)/g

      let match
      while ((match = funcPattern.exec(line)) !== null) {
        const method = match[1]
        const arrName = match[2]
        const info = this.arrays.get(arrName)
        if (!info) {continue}
        if (info.size !== null && info.size > 0) {continue}
        if (this.hasSizeGuard(arrName, i)) {continue}

        diagnostics.push({
          line: i + 1,
          column: match.index + 1,
          endColumn: match.index + 1 + match[0].length,
          message: `Unguarded array.${method}(${arrName}): array may be empty. Check array.size(${arrName}) > 0 first.`,
          severity: 'warning',
        })
      }

      while ((match = methodPattern.exec(line)) !== null) {
        const arrName = match[1]
        const method = match[2]
        if (arrName === 'array') {continue}
        const info = this.arrays.get(arrName)
        if (!info) {continue}
        if (info.size !== null && info.size > 0) {continue}
        if (this.hasSizeGuard(arrName, i)) {continue}

        diagnostics.push({
          line: i + 1,
          column: match.index + 1,
          endColumn: match.index + 1 + match[0].length,
          message: `Unguarded ${arrName}.${method}(): array may be empty. Check ${arrName}.size() > 0 first.`,
          severity: 'warning',
        })
      }
    }

    return diagnostics
  }

  private hasSizeGuard(arrName: string, lineIdx: number): boolean {
    const start = Math.max(0, lineIdx - 5)
    for (let j = start; j < lineIdx; j++) {
      const prevLine = this.lines[j]
      // Check for array.size(arrName) or arrName.size()
      if (
        prevLine.includes(`array.size(${arrName})`) ||
        prevLine.includes(`${arrName}.size()`)
      ) {
        return true
      }
    }
    return false
  }

  private checkLoopBounds(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]

      // for i = 0 to N  (classic for loop)
      const forMatch = line.match(/for\s+(\w+)\s*=\s*0\s+to\s+(\S+)/)
      if (!forMatch) {continue}

      const loopVar = forMatch[1]
      const bound = forMatch[2]

      // Find array accesses in loop body (scan until next top-level statement or blank line after content)
      const bodyArrayAccesses = this.findLoopBodyArrayAccesses(i, loopVar)

      for (const access of bodyArrayAccesses) {
        const { arrName, lineIdx } = access
        const info = this.arrays.get(arrName)
        if (!info) {continue}

        // Check if bound is derived from this array's size
        const isSizeBound =
          bound === `array.size(${arrName})` ||
          bound === `${arrName}.size()` ||
          bound === `array.size(${arrName})-1` ||
          bound === `${arrName}.size()-1` ||
          bound === `array.size(${arrName}) - 1` ||
          bound === `${arrName}.size() - 1` ||
          this.isBoundDerivedFromArraySize(bound, arrName)

        if (!isSizeBound) {
          diagnostics.push({
            line: lineIdx + 1,
            column: 1,
            endColumn: this.lines[lineIdx].length + 1,
            message: `Loop variable '${loopVar}' used to index '${arrName}', but loop bound '${bound}' is not derived from ${arrName}.size(). Possible out-of-bounds access.`,
            severity: 'warning',
          })
        }
      }
    }

    return diagnostics
  }

  private isBoundDerivedFromArraySize(bound: string, arrName: string): boolean {
    // Check if the bound variable was assigned from array.size
    for (const line of this.lines) {
      const assignMatch = line.match(new RegExp(`${this.escapeRegex(bound)}\\s*=\\s*(.+)`))
      if (assignMatch) {
        const rhs = assignMatch[1].trim()
        if (
          rhs.includes(`array.size(${arrName})`) ||
          rhs.includes(`${arrName}.size()`)
        ) {
          return true
        }
      }
    }
    return false
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private findLoopBodyArrayAccesses(
    forLineIdx: number,
    loopVar: string,
  ): { arrName: string; lineIdx: number }[] {
    const results: { arrName: string; lineIdx: number }[] = []
    const forLineIndent = this.getIndent(this.lines[forLineIdx])

    for (let j = forLineIdx + 1; j < this.lines.length; j++) {
      const bodyLine = this.lines[j]
      const trimmed = bodyLine.trim()
      if (trimmed === '') {continue}

      // Stop if we hit a line at same or lesser indentation (end of loop body)
      const indent = this.getIndent(bodyLine)
      if (indent <= forLineIndent && trimmed !== '') {break}

      // Check for array.get(arr, loopVar) or arr.get(loopVar)
      const funcAccess = new RegExp(`array\\.get\\(\\s*(\\w+)\\s*,\\s*${this.escapeRegex(loopVar)}\\s*\\)`)
      const funcMatch = bodyLine.match(funcAccess)
      if (funcMatch) {
        results.push({ arrName: funcMatch[1], lineIdx: j })
      }

      const methodAccess = new RegExp(`(\\w+)\\.get\\(\\s*${this.escapeRegex(loopVar)}\\s*\\)`)
      const methodMatch = bodyLine.match(methodAccess)
      if (methodMatch && methodMatch[1] !== 'array') {
        results.push({ arrName: methodMatch[1], lineIdx: j })
      }
    }

    return results
  }

  private getIndent(line: string): number {
    const match = line.match(/^(\s*)/)
    return match ? match[1].length : 0
  }

  private checkImplicitBoolCast(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    // Collect int/float declarations
    const numericVars = new Set<string>()
    for (const line of this.lines) {
      // Explicit type: var/varip int x = ... or int x = ... or float x = ...
      const intMatch = line.match(/(?:var(?:ip)?\s+)?(?:int|float)\s+(\w+)\s*=/)
      if (intMatch) {
        numericVars.add(intMatch[1])
        continue
      }
      // Implicit type from numeric literal: x = 5 or y = 3.14
      const literalMatch = line.match(/^\s*(\w+)\s*=\s*-?\d+\.?\d*\s*$/)
      if (literalMatch) {
        numericVars.add(literalMatch[1])
      }
    }

    if (numericVars.size === 0) {return diagnostics}

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      const trimmed = line.trim()

      // Match `if varName` or `while varName` or `else if varName`
      // but not `if varName > 0` etc.
      const condMatch = trimmed.match(/^(?:else\s+)?(?:if|while)\s+(\w+)\s*$/)
      if (condMatch) {
        const varName = condMatch[1]
        if (numericVars.has(varName)) {
          const col = line.indexOf(varName) + 1
          diagnostics.push({
            line: i + 1,
            column: col,
            endColumn: col + varName.length,
            message: `Implicit bool cast: '${varName}' is int/float. In Pine v6, use '${varName} != 0' instead.`,
            severity: 'warning',
          })
        }
      }

      // Also match ternary: varName ? ... : ...
      const ternaryMatch = trimmed.match(/^.*=\s*(\w+)\s*\?/)
      if (ternaryMatch) {
        const varName = ternaryMatch[1]
        if (numericVars.has(varName)) {
          const col = line.indexOf(varName + ' ?') + 1
          if (col > 0) {
            diagnostics.push({
              line: i + 1,
              column: col,
              endColumn: col + varName.length,
              message: `Implicit bool cast: '${varName}' is int/float. In Pine v6, use '${varName} != 0' instead.`,
              severity: 'warning',
            })
          }
        }
      }
    }

    return diagnostics
  }

  private hasRecentGuard(lineIdx: number, guards: string[]): boolean {
    const start = Math.max(0, lineIdx - 5)
    for (let j = start; j <= lineIdx; j++) {
      for (const g of guards) {
        if (this.lines[j].includes(g)) {return true}
      }
    }
    return false
  }

  /**
   * Scans forward from an opening paren index for its matching close paren
   * and returns the full "(...)" span. Returns null if unbalanced on this
   * line (e.g. a call that spans multiple lines) — an accepted limitation
   * of this line-based analyzer.
   */
  private extractBalancedCall(line: string, openParenIdx: number): string | null {
    let depth = 0
    for (let i = openParenIdx; i < line.length; i++) {
      if (line[i] === '(') {depth++} else if (line[i] === ')') {
        depth--
        if (depth === 0) {return line.slice(openParenIdx, i + 1)}
      }
    }
    return null
  }

  /** Splits a "(...)" call's argument list on top-level commas, respecting nested ()/[]. */
  private splitTopLevelArgs(callText: string): string[] {
    const inner = callText.slice(callText.indexOf('(') + 1, callText.length - 1)
    const args: string[] = []
    let depth = 0
    let current = ''
    for (const ch of inner) {
      if (ch === '(' || ch === '[') {depth++} else if (ch === ')' || ch === ']') {depth--}
      if (ch === ',' && depth === 0) {
        args.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    if (current.trim() !== '') {args.push(current)}
    return args
  }

  /**
   * Flags request.security() calls at risk of repainting:
   *  - lookahead = barmerge.lookahead_on with no offset ([n]) anywhere in the
   *    call: classic lookahead bias (future data leaking into history).
   *  - a bare, unoffset OHLCV expression (e.g. `close`) with no lookahead
   *    argument at all: the textbook "repaints intrabar" pattern.
   */
  private checkRepaintRisk(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []
    const bareSeriesNames = ['close', 'open', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4']

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      const callIdx = line.indexOf('request.security(')
      if (callIdx === -1) {continue}

      const openParenIdx = callIdx + 'request.security'.length
      const callText = this.extractBalancedCall(line, openParenIdx)
      if (callText === null) {continue}

      const fullCallLength = (openParenIdx - callIdx) + callText.length
      const col = callIdx + 1
      const endCol = col + fullCallLength
      const hasOffset = /\[\s*\d+\s*\]/.test(callText)

      if (/lookahead\s*=\s*barmerge\.lookahead_on/.test(callText) && !hasOffset) {
        diagnostics.push({
          line: i + 1,
          column: col,
          endColumn: endCol,
          message: 'request.security() uses lookahead = barmerge.lookahead_on without an offset (e.g. [1]) on its expression. This can leak future data into historical bars (lookahead bias).',
          severity: 'warning',
        })
        continue
      }

      if (!/lookahead/.test(callText) && !hasOffset) {
        const args = this.splitTopLevelArgs(callText)
        const expr = args[2]?.trim()
        if (expr && bareSeriesNames.includes(expr)) {
          diagnostics.push({
            line: i + 1,
            column: col,
            endColumn: endCol,
            message: `request.security() fetches a bare '${expr}' value with no offset. This can repaint intrabar on the current timeframe — consider '${expr}[1]' for a non-repainting historical value.`,
            severity: 'warning',
          })
        }
      }
    }

    return diagnostics
  }

  /**
   * Flags label.new()/line.new()/box.new() calls that create a fresh object
   * (not held in a `var`/`varip`) with no matching .delete() call and no
   * max_*_count set on the script's declaration statement anywhere in the
   * file — the classic unbounded-drawing-object growth pattern. Skips call
   * sites guarded by a nearby barstate.islast/islastconfirmedhistory check,
   * since those only ever draw once.
   */
  private checkDrawingObjectLeaks(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []
    const drawingTypes = [
      { newPattern: 'label.new(', deletePattern: 'label.delete(', maxParam: 'max_labels_count', displayNew: 'label.new()', displayDelete: 'label.delete()' },
      { newPattern: 'line.new(', deletePattern: 'line.delete(', maxParam: 'max_lines_count', displayNew: 'line.new()', displayDelete: 'line.delete()' },
      { newPattern: 'box.new(', deletePattern: 'box.delete(', maxParam: 'max_boxes_count', displayNew: 'box.new()', displayDelete: 'box.delete()' },
    ]

    for (const dt of drawingTypes) {
      if (this.code.includes(dt.deletePattern)) {continue}
      if (new RegExp(`\\b${this.escapeRegex(dt.maxParam)}\\s*=`).test(this.code)) {continue}

      for (let i = 0; i < this.lines.length; i++) {
        const line = this.lines[i]
        const idx = line.indexOf(dt.newPattern)
        if (idx === -1) {continue}

        const beforeAssign = line.slice(0, idx)
        if (/\bvar(?:ip)?\b/.test(beforeAssign)) {continue}
        if (this.hasRecentGuard(i, ['barstate.islast', 'barstate.islastconfirmedhistory'])) {continue}

        diagnostics.push({
          line: i + 1,
          column: idx + 1,
          endColumn: idx + 1 + dt.newPattern.length,
          message: `${dt.displayNew} is created without a matching ${dt.displayDelete} call and no ${dt.maxParam} set on indicator()/strategy(). Without a "var" holder, a delete call, or a max_*_count limit, these objects can accumulate unbounded across bars.`,
          severity: 'warning',
        })
      }
    }

    return diagnostics
  }

  /**
   * Flags variables assigned from a ternary with a literal `na` branch that
   * are later used directly as an if/while/ternary condition — Pine v6
   * raises a runtime error if a condition evaluates to `na`.
   */
  private checkNaInTernary(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []
    const naVars = new Set<string>()

    for (const line of this.lines) {
      const naFalseBranch = line.match(/^\s*(?:\w+\s+)?(\w+)\s*=\s*.+\?.+:\s*.*\bna\b\s*$/)
      const naTrueBranch = line.match(/^\s*(?:\w+\s+)?(\w+)\s*=\s*.+\?\s*na\b\s*:/)
      const match = naFalseBranch || naTrueBranch
      if (match) {naVars.add(match[1])}
    }

    if (naVars.size === 0) {return diagnostics}

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      const trimmed = line.trim()

      const condMatch = trimmed.match(/^(?:else\s+)?(?:if|while)\s+(\w+)\s*$/)
      if (condMatch && naVars.has(condMatch[1])) {
        const varName = condMatch[1]
        const col = line.indexOf(varName) + 1
        diagnostics.push({
          line: i + 1,
          column: col,
          endColumn: col + varName.length,
          message: `'${varName}' may be 'na' (assigned from a ternary with an 'na' branch) and is used directly as a boolean condition. Pine v6 raises a runtime error if a condition evaluates to 'na' — guard with 'not na(${varName})' first.`,
          severity: 'warning',
        })
      }

      const ternaryCondMatch = trimmed.match(/^.*=\s*(\w+)\s*\?/)
      if (ternaryCondMatch && naVars.has(ternaryCondMatch[1])) {
        const varName = ternaryCondMatch[1]
        const col = line.indexOf(`${varName} ?`) + 1
        if (col > 0) {
          diagnostics.push({
            line: i + 1,
            column: col,
            endColumn: col + varName.length,
            message: `'${varName}' may be 'na' (assigned from a ternary with an 'na' branch) and is used directly as a ternary condition. Pine v6 raises a runtime error if a condition evaluates to 'na' — guard with 'not na(${varName})' first.`,
            severity: 'warning',
          })
        }
      }
    }

    return diagnostics
  }

  /**
   * Flags for/while loops with a bound derived from `bar_index` or a large
   * literal range, run on every bar/tick (not guarded by barstate.islast or
   * barstate.islastconfirmedhistory) — suggests running once or switching to
   * a `var`-based incremental accumulation pattern.
   */
  private checkPerformanceLoops(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []
    const LARGE_BOUND_THRESHOLD = 500

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      const forMatch = line.match(/for\s+\w+\s*=\s*(\S+)\s+to\s+(\S+)/)
      if (!forMatch) {continue}

      const [, fromRaw, toRaw] = forMatch
      const isBarIndexBound = /bar_index/.test(toRaw) || /bar_index/.test(fromRaw)

      const fromNum = parseInt(fromRaw, 10)
      const toNum = parseInt(toRaw, 10)
      const isLargeLiteralBound =
        !Number.isNaN(fromNum) && !Number.isNaN(toNum) && Math.abs(toNum - fromNum) >= LARGE_BOUND_THRESHOLD

      if (!isBarIndexBound && !isLargeLiteralBound) {continue}
      if (this.hasRecentGuard(i, ['barstate.islast', 'barstate.islastconfirmedhistory'])) {continue}

      diagnostics.push({
        line: i + 1,
        column: 1,
        endColumn: line.length + 1,
        message: isBarIndexBound
          ? "Loop bound derived from 'bar_index' iterates over all historical bars on every execution. Wrap this in 'if barstate.islast' to run once, or use a 'var'-based incremental accumulation pattern instead."
          : `Loop with a large bound (~${Math.abs(toNum - fromNum)} iterations) runs on every bar/tick. Wrap this in 'if barstate.islast' to run once, or use a 'var'-based incremental accumulation pattern instead.`,
        severity: 'info',
      })
    }

    return diagnostics
  }

  /**
   * Flags call-site arguments that are obviously series (bar-dependent)
   * expressions passed to a built-in parameter whose documented
   * allowedTypeIDs never include a "series ..." variant (i.e. it requires
   * const/input/simple). Conservative by design — only flags the clear-cut
   * cases from looksLikeSeriesExpression(); skips calls using named
   * arguments (`name = value`), since positional index no longer matches
   * declared argument order once named args are used out of order.
   */
  private checkQualifierMismatch(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []
    if (!this.docsMap) {return diagnostics}

    const callPattern = /\b([a-zA-Z_][\w.]*)\(/g

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      callPattern.lastIndex = 0
      let match
      while ((match = callPattern.exec(line)) !== null) {
        const funcName = match[1]
        const doc = this.docsMap.get(funcName)
        if (!doc || !Array.isArray(doc.args)) {continue}

        const openParenIdx = match.index + match[0].length - 1
        const callText = this.extractBalancedCall(line, openParenIdx)
        if (callText === null) {continue}

        const argExprs = this.splitTopLevelArgs(callText)
        const usesNamedArgs = argExprs.some(a => /^\s*\w+\s*=(?!=)/.test(a))
        if (usesNamedArgs) {continue}

        for (let argIdx = 0; argIdx < doc.args.length && argIdx < argExprs.length; argIdx++) {
          const argDoc = doc.args[argIdx]
          const allowedTypeIDs: string[] = Array.isArray(argDoc?.allowedTypeIDs) ? argDoc.allowedTypeIDs : []
          if (allowedTypeIDs.length === 0) {continue}
          if (allowedTypeIDs.some((t: string) => typeof t === 'string' && t.startsWith('series'))) {continue}

          const exprText = argExprs[argIdx].trim()
          if (!exprText || !looksLikeSeriesExpression(exprText)) {continue}

          diagnostics.push({
            line: i + 1,
            column: match.index + 1,
            endColumn: match.index + 1 + funcName.length,
            message: `'${funcName}' parameter '${argDoc.name}' requires ${allowedTypeIDs.join('/')}, but the argument '${exprText}' looks like a series (bar-dependent) value. Pass a literal, an input.*() result, or another non-series expression.`,
            severity: 'warning',
          })
        }
      }
    }

    return diagnostics
  }

  /** Generic version of findLoopBodyArrayAccesses: finds every match of `pattern` within a for/while loop's indented body. */
  private findLoopBodyMatches(forLineIdx: number, pattern: RegExp): { lineIdx: number; matchText: string }[] {
    const results: { lineIdx: number; matchText: string }[] = []
    const forLineIndent = this.getIndent(this.lines[forLineIdx])
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`

    for (let j = forLineIdx + 1; j < this.lines.length; j++) {
      const bodyLine = this.lines[j]
      const trimmed = bodyLine.trim()
      if (trimmed === '') {continue}

      const indent = this.getIndent(bodyLine)
      if (indent <= forLineIndent) {break}

      const localPattern = new RegExp(pattern.source, flags)
      let match: RegExpExecArray | null
      while ((match = localPattern.exec(bodyLine)) !== null) {
        results.push({ lineIdx: j, matchText: match[0] })
      }
    }

    return results
  }

  /**
   * Static complexity profiler — three self-contained heuristics that don't
   * need any TradingView API (a true per-bar variable/execution inspector
   * isn't achievable against the public pine-facade translate_light
   * endpoint: its response only ever carries compile-time errors/warnings,
   * never runtime values or log output, confirmed via PineLint.handleResponse).
   */
  private checkComplexity(): AnalyzerDiagnostic[] {
    return [
      ...this.checkNestedRequestSecurity(),
      ...this.checkMatrixOpsInLoop(),
      ...this.checkNestedLoops(),
    ]
  }

  /** Flags request.security() calls whose own expression argument contains another request.security() call. */
  private checkNestedRequestSecurity(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      const outerIdx = line.indexOf('request.security(')
      if (outerIdx === -1) {continue}

      const openParenIdx = outerIdx + 'request.security'.length
      const callText = this.extractBalancedCall(line, openParenIdx)
      if (callText === null) {continue}

      // callText is just the "(...)" argument list, so it never includes the
      // outer call's own "request.security" prefix — any occurrence inside
      // it is necessarily a nested call.
      const hasNestedCall = /request\.security\(/.test(callText)
      if (hasNestedCall) {
        diagnostics.push({
          line: i + 1,
          column: outerIdx + 1,
          endColumn: outerIdx + 1 + (openParenIdx - outerIdx) + callText.length,
          message: 'Nested request.security() calls detected. Each call has its own performance cost; nesting compounds it. Consider fetching each timeframe/symbol separately and combining the results.',
          severity: 'info',
        })
      }
    }

    return diagnostics
  }

  /** Flags matrix.* operations running inside a for/while loop body. */
  private checkMatrixOpsInLoop(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []

    for (let i = 0; i < this.lines.length; i++) {
      const trimmed = this.lines[i].trim()
      if (!/^(?:for|while)\b/.test(trimmed)) {continue}

      for (const { lineIdx, matchText } of this.findLoopBodyMatches(i, /matrix\.\w+\(/)) {
        diagnostics.push({
          line: lineIdx + 1,
          column: 1,
          endColumn: this.lines[lineIdx].length + 1,
          message: `Matrix operation '${matchText}' runs inside a loop on every qualifying bar. Matrix operations are relatively expensive — consider precomputing or caching the result outside the loop where possible.`,
          severity: 'info',
        })
      }
    }

    return diagnostics
  }

  /** Flags for/while loops nested inside another for/while loop, via indentation-based scope tracking. */
  private checkNestedLoops(): AnalyzerDiagnostic[] {
    const diagnostics: AnalyzerDiagnostic[] = []
    const openLoops: { indent: number }[] = []

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      const trimmed = line.trim()
      if (trimmed === '') {continue}

      const indent = this.getIndent(line)
      while (openLoops.length > 0 && indent <= openLoops[openLoops.length - 1].indent) {
        openLoops.pop()
      }

      if (/^(?:for|while)\b/.test(trimmed)) {
        if (openLoops.length >= 1) {
          diagnostics.push({
            line: i + 1,
            column: 1,
            endColumn: line.length + 1,
            message: `Nested loop (nesting depth ${openLoops.length + 1}). Nested loops multiply their iteration counts, which can get expensive on every bar. Consider restructuring or caching intermediate results.`,
            severity: 'info',
          })
        }
        openLoops.push({ indent })
      }
    }

    return diagnostics
  }
}
