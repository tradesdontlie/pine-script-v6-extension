# CI/CD Setup Guide

This document describes the CI/CD pipelines configured for this VS Code extension.

## GitHub Actions Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` or `master` branches.

**Jobs:**
- **Build & Test**: 
  - Installs dependencies using pnpm
  - Runs ESLint for code quality checks
  - Performs TypeScript type checking
  - Builds the extension with webpack
  - Runs all tests with Vitest
  - Uploads coverage reports to Codecov (optional)
  - Uploads build artifacts

### 2. Publish Workflow (`.github/workflows/publish.yml`)

Runs when a release is published or manually triggered via workflow dispatch.

**Jobs:**
- **Build & Test**: Same as CI workflow
- **Publish Extension**:
  - Packages the extension as `.vsix`
  - Publishes to Visual Studio Marketplace (requires `VSCE_PAT` secret)
  - Publishes to Open VSX Registry (requires `OVSX_PAT` secret)
  - Uploads VSIX artifact for 30 days

**Manual Trigger Options:**
When triggering manually, you can choose:
- Publish to Visual Studio Marketplace
- Publish to Open VSX Registry

### 3. Pre-release Workflow (`.github/workflows/prerelease.yml`)

Runs on pushes and PRs to `develop` or `dev` branches.

**Jobs:**
- **Build & Pre-release**:
  - Full build pipeline (lint, type-check, build, test)
  - Packages the extension
  - Uploads VSIX artifact for testing

## Required Secrets

Configure these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `VSCE_PAT` | Personal Access Token for Visual Studio Marketplace | Publishing to VS Marketplace |
| `OVSX_PAT` | Personal Access Token for Open VSX Registry | Publishing to Open VSX |
| `CODECOV_TOKEN` | Codecov upload token (optional) | Coverage reporting |

## Getting Your Tokens

### Visual Studio Marketplace PAT

1. Go to https://marketplace.visualstudio.com/manage
2. Create a new organization if you don't have one
3. Create a new personal access token with these scopes:
   - Marketplace (Manage)
4. Copy the token and add it as `VSCE_PAT` secret

### Open VSX Registry PAT

1. Go to https://open-vsx.org/user-settings/tokens
2. Create a new access token
3. Copy the token and add it as `OVSX_PAT` secret

## Local Development Commands

These commands mirror what runs in CI:

```bash
# Install dependencies
pnpm install

# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint:fix

# Type check
pnpm run type-check

# Build extension
pnpm run compile

# Run tests
pnpm run test

# Package extension
pnpm run package
```

## VS Code Integration

The `.vscode` folder contains configurations for:

- **extensions.json**: Recommended extensions for development
- **settings.json**: Editor settings for consistent formatting
- **launch.json**: Debug configurations for running and testing the extension
- **tasks.json**: Build tasks accessible via `Ctrl+Shift+B`

## Branch Strategy

- `main`/`master`: Production-ready code, triggers full CI and auto-publishes on release
- `develop`/`dev`: Development branch, triggers pre-release builds
- Feature branches: Should be branched from `develop`, requires PR to merge

## Artifacts

All workflows upload artifacts that can be downloaded:

- **extension-build**: Compiled JavaScript files in `dist/`
- **extension-vsix**: Packaged extension ready for installation
- **extension-vsix-prerelease**: Pre-release packaged extension

Artifacts are retained for 7-30 days depending on the workflow.
