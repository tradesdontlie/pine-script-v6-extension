/**
 * Pure, vscode-independent "find the declaration offset of a same-file Pine
 * symbol" resolver. Kept separate from PineDefinitionProvider so it's
 * trivially unit-testable against plain strings. Reuses the same kind of
 * declaration shapes PineParser already recognizes (function `=>`
 * declarations, type/enum declarations), plus a first-assignment fallback
 * for plain variables. Cross-file/library symbol resolution is out of scope.
 */

interface DeclPattern {
  regex: RegExp
  group: string
}

const DECL_PATTERNS: DeclPattern[] = [
  { regex: /(?:export\s+)?(?:method\s+)?(?<functionName>\w+)\s*\([^)]*?\)\s*=>/gm, group: 'functionName' },
  { regex: /(?:export\s+)?type\s+(?<typeName>\w+)\s*\n/gm, group: 'typeName' },
  { regex: /(?:export\s+)?enum\s+(?<enumName>\w+)\s*\n/gm, group: 'enumName' },
  { regex: /^\s*(?:var(?:ip)?\s+)?(?:[A-Za-z_][\w.]*(?:<[^>]+>)?\s+)?(?<varName>[A-Za-z_]\w*)\s*=(?!=)/gm, group: 'varName' },
]

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findEarliestMatchOffset(text: string, pattern: RegExp, group: string, targetName: string): number | undefined {
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  let earliest: number | undefined

  while ((match = pattern.exec(text)) !== null) {
    if (match.groups?.[group] === targetName) {
      // Locate the captured name's own position within the full match via a
      // word-boundary sub-search, rather than trusting match indices (which
      // require the ES2022 `d` flag) or a plain indexOf (which could land on
      // a substring collision, e.g. "or" inside "export").
      const nameRegex = new RegExp(`\\b${escapeRegex(targetName)}\\b`)
      const withinMatch = nameRegex.exec(match[0])
      if (withinMatch) {
        const offset = match.index + withinMatch.index
        if (earliest === undefined || offset < earliest) {earliest = offset}
      }
    }
    if (match[0].length === 0) {pattern.lastIndex++}
  }

  return earliest
}

/**
 * Returns the character offset of the earliest matching declaration of
 * `symbolName` in `text`, across function/type/enum/variable declaration
 * shapes, or undefined if none is found.
 */
export function findDefinitionOffset(text: string, symbolName: string): number | undefined {
  let earliest: number | undefined

  for (const { regex, group } of DECL_PATTERNS) {
    const offset = findEarliestMatchOffset(text, regex, group, symbolName)
    if (offset !== undefined && (earliest === undefined || offset < earliest)) {
      earliest = offset
    }
  }

  return earliest
}
