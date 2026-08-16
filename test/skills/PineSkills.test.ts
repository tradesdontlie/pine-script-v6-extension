import { describe, it, expect, beforeAll } from 'vitest'
import * as path from 'path'
import { PineDocsManager } from '../../src/PineDocsManager'
import { PineKnowledgeEngine } from '../../src/knowledge/PineKnowledgeEngine'
import { PineSkillRegistry } from '../../src/skills/PineSkillRegistry'
import { PineDeveloperSkill } from '../../src/skills/PineDeveloperSkill'
import { PineDebuggerSkill } from '../../src/skills/PineDebuggerSkill'
import { PineOptimizerSkill } from '../../src/skills/PineOptimizerSkill'
import { PineVisualizerSkill } from '../../src/skills/PineVisualizerSkill'

describe('PineForge Skills Suite', () => {
  let knowledgeEngine: PineKnowledgeEngine
  let registry: PineSkillRegistry

  beforeAll(() => {
    const docsManager = new PineDocsManager()
    knowledgeEngine = new PineKnowledgeEngine(docsManager)
    registry = new PineSkillRegistry(knowledgeEngine)
    registry.register(new PineDeveloperSkill(knowledgeEngine))
    registry.register(new PineDebuggerSkill(knowledgeEngine))
    registry.register(new PineOptimizerSkill(knowledgeEngine))
    registry.register(new PineVisualizerSkill(knowledgeEngine))
  })

  it('registers all 4 core PineForge skills', () => {
    const skills = registry.getAllSkills()
    expect(skills.length).toBe(4)
    expect(registry.getSkill('pine-developer')).toBeDefined()
    expect(registry.getSkill('pine-debugger')).toBeDefined()
    expect(registry.getSkill('pine-optimizer')).toBeDefined()
    expect(registry.getSkill('pine-visualizer')).toBeDefined()
  })

  it('PineOptimizerSkill detects redundant calculations and HTF security calls', async () => {
    const code = `
//@version=6
indicator("Unoptimized Test")
float val1 = ta.sma(close, 20)
float val2 = ta.sma(close, 20)
float val3 = ta.sma(close, 20)
float htf1 = request.security(syminfo.tickerid, "D", high)
float htf2 = request.security(syminfo.tickerid, "D", low)
`
    const result = await registry.executeSkill('pine-optimizer', {
      userRequest: 'Optimize this script',
      fileContent: code,
      knowledgeEngine,
    })

    expect(result.success).toBe(true)
    expect(result.content).toContain('PINE-CACHE-001')
    expect(result.content).toContain('PINE-HTF-001')
  })

  it('PineVisualizerSkill generates FVG and BOS drawing overlays', async () => {
    const fvgResult = await registry.executeSkill('pine-visualizer', {
      userRequest: 'Generate Fair Value Gap FVG boxes',
      knowledgeEngine,
    })
    expect(fvgResult.success).toBe(true)
    expect(fvgResult.content).toContain('box.new')
    expect(fvgResult.content).toContain('xloc.bar_time')

    const bosResult = await registry.executeSkill('pine-visualizer', {
      userRequest: 'Show Break of Structure BOS levels',
      knowledgeEngine,
    })
    expect(bosResult.success).toBe(true)
    expect(bosResult.content).toContain('line.new')
    expect(bosResult.content).toContain('label.new')
  })
})
