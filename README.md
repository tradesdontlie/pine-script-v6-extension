# Pine Script v6 Language Server

A VS Code / Cursor extension for [TradingView Pine Script v6](https://www.tradingview.com/pine-script-docs/) with real-time diagnostics, intelligent completions, hover documentation, and **local static analysis** that catches array out-of-bounds errors before you compile.

---

## Quick Install

### Option 1: Download and double-click

1. Download **[`INSTALL-ME.vsix`](./INSTALL-ME.vsix)** from this repo
2. Open VS Code or Cursor
3. `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) > **"Extensions: Install from VSIX..."**
4. Select the downloaded `INSTALL-ME.vsix` file
5. Reload the editor

### Option 2: Command line

```bash
# VS Code
code --install-extension INSTALL-ME.vsix

# Cursor
cursor --install-extension INSTALL-ME.vsix
```

### Option 3: Build from source

```bash
git clone https://github.com/TradesDontLie/pinescript-v6-language-server.git
cd pinescript-v6-language-server
pnpm install
pnpm run compile
npx @vscode/vsce package --no-dependencies -o INSTALL-ME.vsix
code --install-extension INSTALL-ME.vsix
```

---

## Features

### Local Static Analysis (NEW)

Catches errors **instantly** without calling the TradingView API:

| Detection | Severity | Example |
|-----------|----------|---------|
| **Array index out of bounds** | Error | `a = array.from(1,2,3)` then `array.get(a, 5)` |
| **Negative index out of bounds** | Error | `array.get(a, -4)` on a size-3 array |
| **Off-by-one with array.size()** | Error | `array.get(a, array.size(a))` — should be `size - 1` |
| **Unguarded .first()/.last()** | Warning | `.first()` on empty array without `.size() > 0` check |
| **Loop bounds mismatch** | Warning | `for i = 0 to 100` with `array.get(arr, i)` |
| **int/float used as bool** | Warning | `if x` where x is numeric — use `x != 0` in v6 |

These diagnostics appear in the **Problems panel** as you type, before the TradingView API even responds.

### IntelliSense and Completions

- **500+ built-in functions** with full signatures (`ta.*`, `array.*`, `matrix.*`, `map.*`, `str.*`, `math.*`, `request.*`, `strategy.*`, etc.)
- **Method completions** — type `myArray.` and get array methods filtered by type
- **User-defined type (UDT) completions** — field suggestions in `.new()` constructors
- **Enum member completions** — type `MyEnum.` and get enum fields
- **Library import completions** — auto-complete imported library functions
- **Inline completion suggestions** — context-aware inline hints

### Hover Documentation

Hover over any function, method, variable, constant, or type to see:

- Full syntax signature
- Parameter descriptions with types and defaults
- Return type
- Remarks and usage notes
- Code examples

### Pine Script v6 Language Support

Full support for v6-specific features:

- **Enums** — `enum` keyword parsing, syntax highlighting, field completions
- **Dynamic requests** — `request.security()` with series strings
- **Enhanced text** — point-based `text_size`, `text.format_bold`, `text.format_italic`
- **Negative array indices** — `array.get(a, -1)` for last element
- **Short-circuit evaluation** — `and`/`or` stop evaluating early
- **Logging** — `log.info()`, `log.warning()`, `log.error()`
- **Footprint data** — `request.footprint()`, `footprint` and `volume_row` types
- **Real-time data** — `bid` and `ask` variables (tick timeframe)
- **Plot line styles** — `plot.linestyle_solid`, `plot.linestyle_dashed`, `plot.linestyle_dotted`

### Remote Linting via TradingView API

In addition to local static analysis, the extension sends your code to TradingView's compiler API for full validation — catching type mismatches, undefined variables, and all compiler errors.

### Syntax Highlighting

- 20 custom themes optimized for Pine Script (dark and light variants)
- Scoped highlighting for namespaces, types, annotations, keywords, and operators
- Embedded Pine Script highlighting in Markdown

### Additional Features

- **Signature help** — parameter hints as you type function arguments
- **Rename provider** — F2 to rename symbols
- **Color provider** — color swatches for hex values in hover
- **Docstring generator** — auto-generate `@param`/`@returns` comments
- **Typify** — annotate variables with inferred types
- **Built-in script browser** — open TradingView's built-in scripts
- **Templates** — create new indicators, strategies, and libraries from templates

---

## Repo Structure

```
.
├── INSTALL-ME.vsix                    <-- GRAB THIS TO INSTALL
├── README.md
├── package.json                        Extension manifest
├── src/
│   ├── extension.ts                    Entry point
│   ├── PineStaticAnalyzer.ts           Local array OOB detection engine
│   ├── PineLint.ts                     Diagnostic pipeline (local + remote)
│   ├── PineCompletionProvider.ts       IntelliSense completions
│   ├── PineSignatureHelpProvider.ts    Parameter hints
│   ├── PineHoverProvider/              Hover documentation (6 files)
│   ├── PineDocsManager.ts             Documentation registry
│   ├── PineParser.ts                   UDT, function, and enum parsing
│   ├── PineFormatResponse.ts           API response processing
│   ├── PineRequest.ts                  TradingView API client
│   ├── PineTypify.ts                   Type annotation engine
│   └── ...
├── Pine_Script_Documentation/
│   └── pineDocs.json                   1.8MB reference (500+ functions, types, variables)
├── syntaxes/
│   └── pine.tmLanguage.json            TextMate grammar
├── themes/                             20 color themes
├── config/
│   └── language-configuration.json     Brackets, indentation, folding
├── test/
│   ├── __mocks__/vscode.ts             VS Code API mock
│   ├── fixtures/                       Pine Script test files
│   ├── PineStaticAnalyzer.test.ts      Static analyzer unit tests
│   ├── PineStaticAnalyzer.edge-cases.test.ts
│   ├── PineDocsManager.test.ts         Docs completeness tests
│   ├── PineParser.test.ts              Parser tests
│   ├── grammar.test.ts                 Grammar coverage tests
│   ├── e2e-fixtures.test.ts            End-to-end tests
│   ├── stress.test.ts                  Performance tests
│   └── smoke.test.ts
├── vitest.config.ts
├── tsconfig.json
└── webpack.config.js
```

---

## Development

```bash
# Install dependencies
pnpm install

# Run tests (68 tests, <1 second)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Compile
pnpm run compile

# Launch in VS Code dev window (F5)
pnpm run start

# Package VSIX
npx @vscode/vsce package --no-dependencies -o INSTALL-ME.vsix
```

---

## Supported File Types

| Extension | Language ID |
|-----------|------------|
| `.pine` | pine |
| `.ps` | pine |
| `.pinescript` | pine |

---

## Requirements

- VS Code 1.93+ or Cursor
- Internet connection (for remote linting via TradingView API — local static analysis works offline)

---

## License

[MIT](./LICENSE.txt)
