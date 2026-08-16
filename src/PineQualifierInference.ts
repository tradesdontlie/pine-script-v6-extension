/**
 * Lightweight, conservative heuristic for deciding whether a Pine expression
 * is "obviously series" (bar-dependent) — used by PineStaticAnalyzer's
 * type-qualifier mismatch check. This intentionally does not attempt full
 * qualifier tracking (const < input < simple < series propagation across
 * arbitrary user variables): it only flags the clear-cut cases, to keep the
 * false-positive rate low for a regex-based, non-type-checking analyzer.
 */

const ALWAYS_SERIES_IDENTIFIERS = [
  'close', 'open', 'high', 'low', 'volume', 'time', 'time_close', 'bar_index',
  'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'bid', 'ask',
]

/**
 * Returns true when `expr` is clearly a series (bar-dependent) value:
 * a bare reference to an OHLCV/bar_index-style built-in, a call into the
 * ta or request namespace (always returns series), or a history-referencing
 * offset like `[1]`/`[i]`. Returns false for literals, input.*() results, and
 * anything else that can't be confidently classified as series (favoring
 * silence over a false positive).
 */
export function looksLikeSeriesExpression(expr: string): boolean {
  const trimmed = expr.trim()
  if (trimmed === '') {return false}

  // Literal values are never series.
  if (/^-?\d+\.?\d*$/.test(trimmed)) {return false}
  if (/^".*"$|^'.*'$/.test(trimmed)) {return false}
  if (/^(true|false)$/.test(trimmed)) {return false}
  if (/^#[0-9a-fA-F]{6,8}$/.test(trimmed)) {return false}

  // input.*() results are "input"-qualified, never series.
  if (/^input\.\w+\(/.test(trimmed)) {return false}

  // History-referencing offset ([1], [i], etc.) always implies series.
  if (/\[[^\]]+\]/.test(trimmed)) {return true}

  // Bare references to bar-dependent built-ins are always series.
  for (const id of ALWAYS_SERIES_IDENTIFIERS) {
    if (new RegExp(`\\b${id}\\b`).test(trimmed)) {return true}
  }

  // Calls into ta.*/request.* namespaces always return series values.
  if (/\b(ta|request)\.\w+\(/.test(trimmed)) {return true}

  return false
}
