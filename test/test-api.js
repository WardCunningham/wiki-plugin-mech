import { describe, it } from 'node:test'
import expect from 'expect.js'
import { api } from '../src/client/blocks.js'
import createThing from 'universal-thing'

const tagged = html => html.replaceAll(/(<\w+) .*?>/g, '$1>')
const event = {
  get shiftKey() {
    return true
  },
}

const show = thing => console.log(thing[createThing.logSymbol])

describe('api for reporting', () => {
  it('trouble notice shown', async () => {
    const elem = createThing(({ type, path, args }) => (type == 'call' && path[0] == 'match' ? null : undefined))
    await api.trouble(elem, 'data')
    expect(tagged(elem.innerHTML)).to.be('root.innerHTML <button>✖︎</button>')
  })
  it('trouble notice clicked', async () => {
    const elem = createThing(({ type, path, args }) => (type == 'call' && path[0] == 'match' ? null : undefined))
    await api.trouble(elem, 'data')
    await elem[createThing.logSymbol][8].args[1].call(event)
    expect(tagged(elem.outerHTML)).to.be('root.outerHTML <span>data</span>')
  })
  it('inspect notice shown', async () => {
    const elem = createThing()
    await api.inspect(elem, 'data', { debug: true, data: 'your data here' })
    expect(elem.previousElementSibling.innerHTML).to.be('data ⇒ ')
  })
  it('inspect notice clicked', async () => {
    global.document = createThing()
    const elem = createThing()
    await api.inspect(elem, 'data', { debug: true, data: 'your data here' })
    await elem[createThing.logSymbol][3].args[1].call(event)
    // show(elem)
    // show(document)
    const tap = elem.previousElementSibling.previousElementSibling
    expect(tagged(tap.innerHTML)).to.be('<div>"your data here"</div>')
  })
})
