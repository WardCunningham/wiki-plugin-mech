import { describe, it } from 'node:test'
import expect from 'expect.js'
import * as plugin from '../src/client/mech.js'
import thing from 'universal-thing'

const logSymbol = thing.logSymbol
const show = (name, thing) => console.log(name, thing[logSymbol])
const tagged = html => html.replaceAll(/(<\w+) .*?>/g, '$1>').replaceAll(/\n */g, '')
const has = (thing, type) => thing[logSymbol].filter(log => log.type == type)

const returning =
  (funct, value) =>
  ({ type, path, args }) =>
    type == 'call' && path[0] == funct ? value : undefined

describe('mech as plugin', () => {
  it('emits and runs the blocks', async () => {
    const $page = thing()
    const $item = thing(returning('parents', $page))
    const item = { text: 'HELLO' }
    global.wiki = thing()
    global.window = thing()
    global.document = thing()
    plugin.emit($item, item)
    // show('$item',$item)
    // show('document',document)
    const html = has($item, 'call')[1].args[0]
    expect(tagged(html)).to.be('<div><font></font><span>HELLO</span></div>')
    const happy = has(document, 'set').find(set => set.args[1].match(/😀/))
    expect(!!happy).to.be(true)
  })
  it('binds double-click to edit', () => {
    const $item = thing()
    const item = { text: 'HELLO' }
    global.wiki = thing()
    plugin.bind($item, item)
    const handler = has($item, 'call')[0].args[0]
    handler()
    const editor = has(global.wiki, 'call')[0].path[0]
    expect(editor).to.be('textEditor')
  })
})
