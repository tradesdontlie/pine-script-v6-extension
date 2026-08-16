import { describe, it, expect } from 'vitest'
import { findDefinitionOffset } from '../src/PineDefinitionResolver'

describe('findDefinitionOffset', () => {
  it('finds a function declaration, not a later call site', () => {
    const code = `f(x) =>
    x + 1
y = f(5)
`
    const offset = findDefinitionOffset(code, 'f')
    expect(offset).toBe(0)
  })

  it('finds a type declaration', () => {
    const code = `type Foo
    float price
`
    const offset = findDefinitionOffset(code, 'Foo')
    expect(offset).toBe(code.indexOf('Foo'))
  })

  it('finds an enum declaration', () => {
    const code = `enum Bar
    A
    B
`
    const offset = findDefinitionOffset(code, 'Bar')
    expect(offset).toBe(code.indexOf('Bar'))
  })

  it('finds a plain variable declaration, not a later usage', () => {
    const code = `x = 5
y = x + 1
`
    const offset = findDefinitionOffset(code, 'x')
    expect(offset).toBe(0)
  })

  it('returns the earliest occurrence when a variable is reassigned with :=', () => {
    const code = `x = 5
if true
    x := 10
`
    const offset = findDefinitionOffset(code, 'x')
    expect(offset).toBe(0)
  })

  it('returns undefined when the symbol has no declaration', () => {
    const code = `x = 5
y = x + 1
`
    expect(findDefinitionOffset(code, 'zzz')).toBeUndefined()
  })

  it('handles var/varip prefixes on variable declarations', () => {
    const code = `var lbl = na
if barstate.islast
    lbl := label.new(bar_index, high)
`
    const offset = findDefinitionOffset(code, 'lbl')
    expect(offset).toBe(code.indexOf('lbl'))
  })
})
