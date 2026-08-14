/**
 * PineVisualizerSkill - Semantic market structure and visual overlay generator
 * 
 * Capabilities:
 * - BOS (Break of Structure) & CHoCH visualization
 * - FVG (Fair Value Gap) box overlays
 * - Liquidity Sweep marker annotations
 * - Order Block zones with xloc.bar_time coordinates
 */

import { PineSkill, PineSkillContext, PineSkillDefinition, PineSkillResult } from './PineSkill'

export class PineVisualizerSkill extends PineSkill {
  readonly definition: PineSkillDefinition = {
    id: 'pine-visualizer',
    name: 'Pine Script Visualizer',
    description: 'Generates drawing methods and visual overlays for market structure, FVG, BOS, and liquidity zones.',
    version: '1.0.0',
    triggerPatterns: ['visualize', 'fvg', 'bos', 'liquidity', 'drawing', 'orderblock'],
    requiredTools: ['pine_validate'],
    optionalTools: ['pine_search_docs', 'pine_patch'],
  }

  async execute(context: PineSkillContext): Promise<PineSkillResult> {
    const req = context.userRequest.toLowerCase()
    let snippet = ''

    if (req.includes('fvg') || req.includes('fair value gap')) {
      snippet = this.generateFVGOverlay()
    } else if (req.includes('bos') || req.includes('break of structure') || req.includes('choch')) {
      snippet = this.generateBOSOverlay()
    } else if (req.includes('liquidity') || req.includes('sweep')) {
      snippet = this.generateLiquiditySweepOverlay()
    } else {
      snippet = this.generateGenericVisualizer()
    }

    return {
      success: true,
      content: snippet,
    }
  }

  private generateFVGOverlay(): string {
    return `// === PineForge Visualizer: Fair Value Gap (FVG) Overlay (v6) ===
// Bullish FVG: Low[0] > High[2]
bool isBullFVG = low > high[2]
if isBullFVG
    box.new(
        left = time[2],
        top = low,
        right = time,
        bottom = high[2],
        xloc = xloc.bar_time,
        border_color = color.new(color.green, 60),
        bgcolor = color.new(color.green, 85)
    )

// Bearish FVG: High[0] < Low[2]
bool isBearFVG = high < low[2]
if isBearFVG
    box.new(
        left = time[2],
        top = low[2],
        right = time,
        bottom = high,
        xloc = xloc.bar_time,
        border_color = color.new(color.red, 60),
        bgcolor = color.new(color.red, 85)
    )`
  }

  private generateBOSOverlay(): string {
    return `// === PineForge Visualizer: Break of Structure (BOS) Overlay (v6) ===
float swingHigh = ta.highest(high, 10)[1]
float swingLow = ta.lowest(low, 10)[1]

bool isBullBOS = ta.crossover(close, swingHigh)
if isBullBOS
    line.new(
        x1 = time[10],
        y1 = swingHigh,
        x2 = time,
        y2 = swingHigh,
        xloc = xloc.bar_time,
        color = color.teal,
        width = 2,
        style = line.style_dashed
    )
    label.new(
        x = time,
        y = swingHigh,
        text = "BOS",
        xloc = xloc.bar_time,
        style = label.style_label_down,
        color = color.teal,
        textcolor = color.white,
        size = size.small
    )`
  }

  private generateLiquiditySweepOverlay(): string {
    return `// === PineForge Visualizer: Liquidity Sweep Marker (v6) ===
float prevHigh = ta.highest(high, 20)[1]
bool isSweepHigh = high > prevHigh and close < prevHigh

if isSweepHigh
    label.new(
        x = time,
        y = high,
        text = "Sweep (BSL)",
        xloc = xloc.bar_time,
        style = label.style_label_down,
        color = color.orange,
        textcolor = color.white,
        size = size.small
    )`
  }

  private generateGenericVisualizer(): string {
    return `// === PineForge Visualizer: Order Block Zone (v6) ===
type OrderBlockZone
    box obBox
    float top
    float bottom
    bool active

method draw(OrderBlockZone this, int startTime, float topPrice, float botPrice, color obColor) =>
    this.obBox := box.new(
        left = startTime,
        top = topPrice,
        right = time,
        bottom = botPrice,
        xloc = xloc.bar_time,
        border_color = color.new(obColor, 50),
        bgcolor = color.new(obColor, 80)
    )`
  }
}
