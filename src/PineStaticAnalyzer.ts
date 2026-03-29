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

  constructor(code: string) {
    this.code = code
    this.lines = code.split('\n')
  }

  analyze(): AnalyzerDiagnostic[] {
    if (!this.isV6()) return []

    const diagnostics: AnalyzerDiagnostic[] = []

    this.collectArrayDeclarations()
    diagnostics.push(...this.checkOOB())
    diagnostics.push(...this.checkUnguardedFirstLast())
    diagnostics.push(...this.checkLoopBounds())
    diagnostics.push(...this.checkImplicitBoolCast())

    return diagnostics
  }

  private isV6(): boolean {
    for (const line of this.lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('//@version=6')) return true
      if (trimmed.startsWith('//@version=')) return false
      // Skip blank lines and comments at top
      if (trimmed === '' || trimmed.startsWith('//')) continue
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
          const method = match[1]
          const arrName = match[2]
          const idx = parseInt(match[3], 10)
          const info = this.arrays.get(arrName)
          if (!info || info.size === null) continue

          const col = match.index + 1
          const endCol = col + match[0].length
          const diag = this.checkIndexBounds(info, idx, i + 1, col, endCol, `array.${method}`)
          if (diag) diagnostics.push(diag)
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
          if (/^\s*-\s*1/.test(afterMatch)) continue

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
        const method = match[2]
        const idx = parseInt(match[3], 10)
        // Skip if this looks like array.get (function syntax already handled above)
        if (arrName === 'array') continue
        const info = this.arrays.get(arrName)
        if (!info || info.size === null) continue

        const col = match.index + 1
        const endCol = col + match[0].length
        const diag = this.checkIndexBounds(info, idx, i + 1, col, endCol, `.${method}`)
        if (diag) diagnostics.push(diag)
      }

      // Method syntax off-by-one: a.get(a.size())
      const sizeOffByOneMethod = /(\w+)\.(get|set)\(\s*(\w+)\.size\(\)\s*[,)]/g
      while ((match = sizeOffByOneMethod.exec(line)) !== null) {
        const arrName = match[1]
        const method = match[2]
        const sizeObj = match[3]
        if (arrName === 'array') continue
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
    accessDesc: string,
  ): AnalyzerDiagnostic | null {
    if (info.size === null) return null

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
        if (!info) continue
        if (info.size !== null && info.size > 0) continue
        if (this.hasSizeGuard(arrName, i)) continue

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
        if (arrName === 'array') continue
        const info = this.arrays.get(arrName)
        if (!info) continue
        if (info.size !== null && info.size > 0) continue
        if (this.hasSizeGuard(arrName, i)) continue

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
      if (!forMatch) continue

      const loopVar = forMatch[1]
      const bound = forMatch[2]

      // Find array accesses in loop body (scan until next top-level statement or blank line after content)
      const bodyArrayAccesses = this.findLoopBodyArrayAccesses(i, loopVar)

      for (const access of bodyArrayAccesses) {
        const { arrName, lineIdx } = access
        const info = this.arrays.get(arrName)
        if (!info) continue

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
      if (trimmed === '') continue

      // Stop if we hit a line at same or lesser indentation (end of loop body)
      const indent = this.getIndent(bodyLine)
      if (indent <= forLineIndent && trimmed !== '') break

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

    if (numericVars.size === 0) return diagnostics

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
}
