# AGENTS.md — mandatory rules for coding agents

These rules override default behavior. Follow them in every session.

## Project quick facts
- **Name**: Pine Script v6 VS Code Extension
- **Entry point**: `src/extension.ts`
- **Folder map**: `src/` (TypeScript source), `test/` (vitest tests), `syntaxes/` (Pine grammar), `themes/` (color themes)
- **Test commands**: `pnpm test` (vitest), `pnpm run lint` (eslint)
- **Build**: `pnpm run compile` (webpack), `pnpm run vscode:prepublish`
- **Safety invariants**: Keep strict TypeScript; no `any` / `@ts-ignore`; preserve extension activation logic

## Working style
- When asked to implement/fix/add, ALWAYS edit the actual files.
  Never reply with only explanations or chat-only snippets.
- Read relevant code/docs before editing. Match existing style and structure.
- Smallest change that solves the task. No unrelated refactors, reformatting,
  or comment churn.
- No new dependencies unless explicitly requested.
- If the editor tool fails, write the file via bash heredoc instead.
  Never fabricate results or silently fall back to text-only answers.

## Git & session rules
- Run `git remote -v` first. If empty, restore it (token from env; never print it):
  ```bash
  git remote add origin "https://shubhamtaywade82:${GITHUB_TOKEN}@github.com/shubhamtaywade82/$(basename "$(pwd)").git"
  ```
- Stay on the current branch. Create a new branch only if explicitly asked
  (`git switch -c <name>`, then verify with `git branch --show-current`).
- Never use `git add -A`. Use `git add -u` plus explicit `git add <new files>`.
- NEVER edit .gitignore, CI workflows, LICENSE, or lockfiles unless explicitly
  asked. Propose such changes in chat instead of applying them.
- Commit with a concise message, then `git push -u origin HEAD`.
- End every task by showing `git status --short` and `git log --oneline -1`
  as proof the change landed.

## Secrets
- Secrets come from ENV only. Never hardcode or print keys/tokens/passwords.
- Never commit `.env`; only `.env.example`.

## Verification
- After edits, run the stack checks below and fix any failures you introduced.
- If a check cannot be run, state exactly which one and why.

## Stack: TypeScript / Node
- Deps: `pnpm install` (per pnpm-lock.yaml).
- Checks: `npx tsc --noEmit`, `pnpm test`, `pnpm run compile`.
- Do not weaken tsconfig strictness; no `any` / `@ts-ignore` unless asked.
- Keep the public API stable; note breaking changes only when asked.
- Do not commit `dist/` or `out/` unless the repo already tracks them.
