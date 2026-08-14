/**
 * sync-pine-reference.ts - Synchronizes local Pine docs and produces PineReferenceManifest
 */

import * as fs from 'fs'
import * as path from 'path'
import { PineReferenceNormalizer } from '../src/conformance/PineReferenceNormalizer'

export function syncPineReference(rootDir: string = path.join(__dirname, '..')): void {
  const docsPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineDocs.json')
  const rawDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'))

  // 1. Sync UDT sorting & binary search parameters to functions and methods
  const sortFieldArg = {
    name: 'sort_field',
    type: 'const int | const string',
    info: 'Field index or name used to sort/search collections of user-defined types (UDTs).',
    required: false,
  }

  const sortFunctions = ['array.sort', 'array.sort_indices', 'matrix.sort']
  const searchFunctions = ['array.binary_search', 'array.binary_search_leftmost', 'array.binary_search_rightmost']

  for (const fn of rawDocs.functions?.[0]?.docs ?? []) {
    if (sortFunctions.includes(fn.name) || searchFunctions.includes(fn.name)) {
      fn.args = fn.args || []
      if (!fn.args.some((a: { name: string }) => a.name === 'sort_field')) {
        fn.args.push(sortFieldArg)
      }
    }
    if (fn.name === 'strategy') {
      fn.args = fn.args || []
      if (!fn.args.some((a: { name: string }) => a.name === 'calc_on_every_history_tick')) {
        fn.args.push({
          name: 'calc_on_every_history_tick',
          type: 'const bool',
          info: 'Enables strategy calculations on every available historical tick.',
          required: false,
          default: 'false',
        })
      }
    }
  }

  for (const method of rawDocs.methods?.[0]?.docs ?? []) {
    if (sortFunctions.includes(method.name) || searchFunctions.includes(method.name)) {
      method.args = method.args || []
      if (!method.args.some((a: { name: string }) => a.name === 'sort_field')) {
        method.args.push(sortFieldArg)
      }
    }
  }

  // 2. Save updated pineDocs.json
  fs.writeFileSync(docsPath, JSON.stringify(rawDocs, null, 2), 'utf-8')

  // 3. Generate canonical PineReferenceManifest
  const manifest = PineReferenceNormalizer.normalizeRawDocs(rawDocs, '6.0.0-synced')
  const manifestPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineReferenceManifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  // 4. Generate version metadata
  const versionPath = path.join(rootDir, 'Pine_Script_Documentation', 'pineReferenceVersion.json')
  fs.writeFileSync(
    versionPath,
    JSON.stringify(
      {
        version: '6.0.0',
        lastSynchronized: new Date().toISOString(),
        totalSymbols: Object.keys(manifest.symbols).length,
        languageFeatures: manifest.languageFeatures,
      },
      null,
      2,
    ),
    'utf-8',
  )
}

if (require.main === module) {
  syncPineReference()
  console.log('✓ Pine Script v6 Reference and Canonical Manifest synchronized successfully.')
}
