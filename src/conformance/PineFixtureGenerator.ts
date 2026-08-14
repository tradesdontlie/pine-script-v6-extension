/**
 * PineFixtureGenerator - Synthesizes Pine Script v6 test fixtures from canonical specifications
 */

export interface ConformanceFixture {
  name: string
  description: string
  code: string
  expectedValid: boolean
  targetFeature: string
}

export class PineFixtureGenerator {
  static getStandardConformanceFixtures(): ConformanceFixture[] {
    return [
      {
        name: 'multiline_strings_double_quotes',
        description: 'Validate support for triple-double-quoted multiline strings',
        targetFeature: 'multiline_strings',
        expectedValid: true,
        code: `//@version=6
indicator("Multiline String Test")
string s = """
line one
line two
line three
"""
plot(str.length(s))`,
      },
      {
        name: 'multiline_strings_single_quotes',
        description: 'Validate support for triple-single-quoted multiline strings',
        targetFeature: 'multiline_strings',
        expectedValid: true,
        code: `//@version=6
indicator("Multiline String Single Test")
string s = '''
line one
line two
'''
plot(str.length(s))`,
      },
      {
        name: 'udt_array_sort_field',
        description: 'Validate UDT array.sort with sort_field argument',
        targetFeature: 'udt_sorting',
        expectedValid: true,
        code: `//@version=6
indicator("UDT Sort Test")
type OrderBlock
    float price
    int timestamp
    string kind

var array<OrderBlock> blocks = array.new<OrderBlock>()
array.sort(blocks, sort_field = "price")
array.sort_indices(blocks, sort_field = 0)`,
      },
      {
        name: 'udt_array_binary_search_field',
        description: 'Validate UDT array.binary_search with sort_field argument',
        targetFeature: 'udt_binary_search',
        expectedValid: true,
        code: `//@version=6
indicator("UDT Binary Search Test")
type Block
    float val

var array<Block> blocks = array.new<Block>()
Block target = Block.new(100.0)
int idx = array.binary_search(blocks, target, sort_field = "val")
int left = array.binary_search_leftmost(blocks, target, sort_field = 0)
int right = array.binary_search_rightmost(blocks, target, sort_field = "val")`,
      },
      {
        name: 'strategy_calc_on_every_history_tick',
        description: 'Validate strategy with calc_on_every_history_tick parameter',
        targetFeature: 'strategy_history_ticks',
        expectedValid: true,
        code: `//@version=6
strategy("History Tick Strategy", calc_on_every_history_tick = true)
if ta.crossover(ta.sma(close, 14), ta.sma(close, 28))
    strategy.entry("Long", strategy.long)`,
      },
      {
        name: 'footprint_and_volume_row_types',
        description: 'Validate request.footprint, footprint and volume_row types',
        targetFeature: 'footprint',
        expectedValid: true,
        code: `//@version=6
indicator("Footprint Conformance")
footprint fp = request.footprint(syminfo.tickerid, "1D")
volume_row vr = na`,
      },
    ]
  }
}
