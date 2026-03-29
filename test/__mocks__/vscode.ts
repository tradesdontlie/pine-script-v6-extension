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
  source?: string
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
