import { describe, it } from 'node:test'
import expect from 'expect.js'
import { api } from '../src/client/blocks.js'
import thing from 'universal-thing'

const logSymbol = thing.logSymbol
const show = (name, thing) => console.log(name, thing[logSymbol])
const tagged = html => html.replaceAll(/(<\w+) .*?>/g, '$1>').replaceAll(/\n */g, '')
const has = (thing, type) => thing[logSymbol].filter(log => log.type == type)
const onclick = thing =>
  thing[logSymbol].find(log => (log.type == 'call') & (log.path[0] == 'addEventListener') && log.args[0] == 'click')
    .args[1]
const returning =
  (funct, value) =>
  ({ type, path, args }) =>
    type == 'call' && path[0] == funct ? value : undefined
const retrieving =
  (obj, value) =>
  ({ type, path, args }) =>
    type == 'get' && path[0] == obj ? value : undefined
const event = {
  get shiftKey() {
    return false
  },
}

describe('api for inline reporting', () => {
  it('trouble notice shown', async () => {
    const elem = thing(returning('match', null))
    await api.trouble(elem, 'data')
    expect(tagged(elem.innerHTML)).to.be('root.innerHTML <button>✖︎</button>')
  })
  it('trouble notice clicked', async () => {
    const elem = thing(returning('match', null))
    await api.trouble(elem, 'data')
    await onclick(elem).call(event)
    expect(tagged(elem.outerHTML)).to.be('root.outerHTML <span>data</span>')
  })
  it('inspect notice omitted', async () => {
    const elem = thing()
    await api.inspect(elem, 'data', { debug: false, data: 'your data here' })
    expect(elem.previousElementSibling.innerHTML).to.be('')
  })
  it('inspect notice shown', async () => {
    const elem = thing()
    await api.inspect(elem, 'data', { debug: true, data: 'your data here' })
    expect(elem.previousElementSibling.innerHTML).to.be('data ⇒ ')
  })
  it('inspect notice clicked', async () => {
    global.document = thing()
    const elem = thing(returning('contains', false))
    await api.inspect(elem, 'data', { debug: true, data: 'your data here' })
    await onclick(elem).call(event)
    const tap = elem.previousElementSibling.previousElementSibling
    expect(tagged(tap.innerHTML)).to.be('<div>"your data here"</div>')
  })
  it('response shown', async () => {
    const elem = thing()
    await api.response(elem, ' 😀')
    expect(elem.innerHTML).to.be('root.innerHTML  😀')
  })
  it('button clicked', async () => {
    const elem = thing(returning('match', null))
    await api.button(elem, 'doit', event => api.response(elem, 'clicked'))
    await onclick(elem).call(event)
    expect(tagged(elem.innerHTML)).to.be('root.innerHTML <button>doit</button>clicked')
  })
  it('status shown', async () => {
    const elem = thing()
    await api.status(elem, 'block', ' ⇒ 100 units')
    expect(elem.innerHTML).to.be('block ⇒ 100 units')
  })
})

describe('api for acquisiton and generation', () => {
  it('element by id', () => {
    global.document = thing()
    const elem = thing()
    api.element('1.2.0')
    expect(document[logSymbol][1].args[0]).to.be('1.2.0')
  })
  it('json from url', async () => {
    global.fetch = thing()
    const elem = thing()
    await api.jfetch('http://fed.wiki/system/sitemap.json')
    expect(fetch[logSymbol][0].args[0]).to.be('http://fed.wiki/system/sitemap.json')
  })
  it('source data from lineup', async () => {
    const elem = thing()
    const items = ['far', 'near'].map(data => thing(returning('markersData', data)))
    global.document = thing(returning('querySelectorAll', items))
    const sources = await api.sourceData(elem, 'markers')
    expect(sources[0].result).to.be('near')
  })
  it('trouble source data from lineup', async () => {
    const elem = thing(returning('match', null))
    const items = [].map(data => thing(returning('markersData', data)))
    global.document = thing(returning('querySelectorAll', items))
    const sources = await api.sourceData(elem, 'markers')
    // show('elem', elem)
    expect(tagged(elem.innerHTML)).to.be(`root.innerHTML <button>✖︎</button>`)
  })
  it('publish source aspect data', () => {
    const elem = thing()
    const data = thing()
    api.publishSourceData(elem, 'aspect', data)
    expect(has(elem, 'call')[1].args[0]).to.be(`aspect-source`)
    expect(has(elem, 'set')[0].args[0]).to.be(`aspectData`)
  })
  it('publish source markers data', () => {
    const elem = thing()
    const data = thing()
    api.publishSourceData(elem, 'markers', data)
    expect(has(elem, 'call')[1].args[0]).to.be(`markers-source`)
    expect(has(elem, 'set')[0].args[0]).to.be(`markersData`)
  })
  it('show result as ghost page', () => {
    const elem = thing()
    global.wiki = thing()
    global.$ = thing()
    const page = { title: 'Test', story: [] }
    api.showResult(elem, page)
    expect(has(global.wiki, 'call')[0].path[0]).to.be(`newPage`)
    expect(has(global.wiki, 'call')[1].path[0]).to.be(`showResult`)
  })
  it('all sitemaps from neighborhod', () => {
    const info = title => ({ title })
    const sitemap = infos => ({ sitemapRequestInflight: false, sitemap: infos })
    const sites = {
      'fed.wiki': sitemap([info('Test Page')]),
      'npl.wiki': sitemap([info('Hello'), info('Goodbye')]),
    }
    global.wiki = thing(retrieving('neighborhoodObject', sites))
    const page = { title: 'Test', story: [] }
    const result = api.neighborhood()
    const pages = result.flat().map(info => info.title)
    expect(pages.join(', ')).to.be(`Test Page, Hello, Goodbye`)
  })
  it('some sitemaps from neighborhod', () => {
    const info = title => ({ title })
    const sitemap = infos => ({ sitemapRequestInflight: false, sitemap: infos })
    const sites = {
      'fed.wiki': sitemap([info('Test Page')]),
      'wiki.org': sitemap([info('Hello'), info('Goodbye')]),
    }
    global.wiki = thing(retrieving('neighborhoodObject', sites))
    const result = api.neighborhood('org')
    const pages = result.flat().map(info => info.title)
    expect(pages.join(', ')).to.be(`Hello, Goodbye`)
  })
})

describe('api for svg graphics', () => {
  it('create inline svg', () => {
    const div = thing()
    global.document = thing(returning('createElement', div))
    const elem = thing()
    api.newSVG(elem)
    expect(tagged(div.outerHTML)).to.be('<div><svg><circle></circle></svg></div>')
  })
  it('add line to svg', () => {
    const svg = thing()
    const line = thing()
    global.document = thing(returning('createElementNS', line))
    api.SVGline(svg, [10, 20], [100, 200])
    const xy = has(line, 'call').map(each => each.args)
    expect(xy.flat().join(' ')).to.be('x1 10 y1 380 x2 100 y2 200')
  })
})
