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

const show = (name,thing) => console.log(name,thing[logSymbol])

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
    const tap = elem.previousElementSibling.previousElementSibling
    expect(tagged(tap.innerHTML)).to.be('<div>"your data here"</div>')
  })
  it('response shown', async () => {
    const elem = createThing()
    await api.response(elem, ' 😀')
    expect(elem.innerHTML).to.be('root.innerHTML  😀')
  })
  it('button clicked', async () => {
    const elem = createThing(returning('match', null))
    await api.button(elem, 'doit', event => api.response(elem, 'clicked'))
    await onclick(elem).call(event)
    expect(tagged(elem.innerHTML)).to.be('root.innerHTML <button>doit</button>clicked')
  })
  it('status shown', async () => {
    const elem = createThing()
    await api.status(elem, 'block', ' ⇒ 100 units')
    expect(elem.innerHTML).to.be('block ⇒ 100 units')
  })
})
describe('api for acquisiton', () => {
  it('element by id', () => {
    global.document = createThing()
    const elem = createThing()
    api.element('1.2.0')
    expect(document[logSymbol][1].args[0]).to.be('1.2.0')
  })
  it('json from url', async () => {
    global.fetch = createThing()
    const elem = createThing()
    await api.jfetch('http://fed.wiki/system/sitemap.json')
    // show(fetch)
    expect(fetch[logSymbol][0].args[0]).to.be('http://fed.wiki/system/sitemap.json')
  })
  it('source data from lineup', async () => {
    const items = [
      createThing(returning('markersData',[1,2,3])),
      createThing(returning('markersData',[4,5,6]))]
    global.document = createThing(returning('querySelectorAll',items))
    const elem = createThing()
    const results = await api.sourceData(elem, 'markers')
    const sorted = results.map(r => r.result).flat().sort().join(" ")
    expect(sorted).to.be('1 2 3 4 5 6')
  })
})
