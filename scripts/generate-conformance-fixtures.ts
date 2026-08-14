/**
 * generate-conformance-fixtures.ts - Emits Pine Script v6 conformance fixtures
 */

import * as fs from 'fs'
import * as path from 'path'
import { PineFixtureGenerator } from '../src/conformance/PineFixtureGenerator'

export function generateConformanceFixtures(rootDir: string = path.join(__dirname, '..')): string[] {
  const fixturesDir = path.join(rootDir, 'test', 'fixtures', 'conformance')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  const generatedFiles: string[] = []
  const fixtures = PineFixtureGenerator.getStandardConformanceFixtures()

  for (const fix of fixtures) {
    const filePath = path.join(fixturesDir, `${fix.name}.pine`)
    fs.writeFileSync(filePath, fix.code, 'utf-8')
    generatedFiles.push(filePath)
  }

  return generatedFiles
}

if (require.main === module) {
  const files = generateConformanceFixtures()
  console.log(`✓ Generated ${files.length} Pine v6 conformance fixtures in test/fixtures/conformance/`)
}
