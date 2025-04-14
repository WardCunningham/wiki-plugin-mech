import { describe, it } from 'node:test'
import expect from 'expect.js'
import { api } from '../src/client/blocks.js'
import createThing from 'universal-thing'

const logSymbol = createThing.logSymbol
const tagged = html => html.replaceAll(/(<\w+) .*?>/g, '$1>')
const onclick = thing =>
  thing[logSymbol].find(log => (log.type == 'call') & (log.path[0] == 'addEventListener') && log.args[0] == 'click')
    .args[1]
const returning =
  (funct, value) =>
  ({ type, path, args }) =>
    type == 'call' && path[0] == funct ? value : undefined
const event = {
  get shiftKey() {
    return false
  },
}

const show = thing => console.log(thing[logSymbol])

describe('api for reporting', () => {
  it('trouble notice shown', async () => {
    const elem = createThing(returning('match', null))
    await api.trouble(elem, 'data')
    expect(tagged(elem.innerHTML)).to.be('root.innerHTML <button>✖︎</button>')
  })
  it('trouble notice clicked', async () => {
    const elem = createThing(returning('match', null))
    await api.trouble(elem, 'data')
    await onclick(elem).call(event)
    expect(tagged(elem.outerHTML)).to.be('root.outerHTML <span>data</span>')
  })
  it('inspect notice omitted', async () => {
    const elem = createThing()
    await api.inspect(elem, 'data', { debug: false, data: 'your data here' })
    expect(elem.previousElementSibling.innerHTML).to.be('')
  })
  it('inspect notice shown', async () => {
    const elem = createThing()
    await api.inspect(elem, 'data', { debug: true, data: 'your data here' })
    expect(elem.previousElementSibling.innerHTML).to.be('data ⇒ ')
  })
  it('inspect notice clicked', async () => {
    global.document = createThing()
    const elem = createThing(returning('contains', false))
    await api.inspect(elem, 'data', { debug: true, data: 'your data here' })
    await onclick(elem).call(event)
    show(elem)
    // show(document)
    const tap = elem.previousElementSibling.previousElementSibling
    expect(tagged(tap.innerHTML)).to.be('<div>"your data here"</div>')
  })
})
