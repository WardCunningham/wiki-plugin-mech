import * as mech from '../src/client/mech.js'
import { describe, it } from 'node:test'
import expect from 'expect.js'

const api = {
  trouble(elem, text) {
    this.log.push(`trouble ${text.trim()}`)
  },
  response(elem, text) {
    this.log.push(`response ${text.trim()}`)
  },
  button(elem, label, handler) {
    this.response(elem, `<button style="border-width:0;">${label}</button>`)
    this.handler = handler
  },
  inspect(elem, key, state) {
    if (state.debug) this.log.push(`inspect ${key}`)
  },
  click(pressed = false) {
    const event = {
      get shiftKey() {
        return pressed
      },
    }
    this.handler.apply(null, [event])
  },
  element(key) {
    return `element ${key}`
  },
  jfetch(url) {
    this.log.push(`fetch ${url}`)
    return new Promise(res => res(this.files.shift()))
  },
  status(elem, command, text) {
    this.log.push(`status ${text}`)
  },
  sourceData(elem, topic) {
    this.log.push(`source ${topic}`)
    return this.files.shift()
  },
  showResult(elem, page) {
    this.log.push(`show ${page.title}`)
  },

  log: [],
  files: [],
  handler: null,
}

;(function () {
  const tags = /<(\/?.\w+).*?>/g
  const setup = async (blocks, state = {}) => {
    const lines = blocks.split(/\|/).map(line => line.trim().replaceAll(/_/g, ' '))
    const nest = mech.tree(lines, [], 0)
    const html = mech.format(nest)
    Object.assign(state, { api })
    api.log.length = 0
    await mech.run(nest, state)
  }

  describe('mech plugin blocks', () => {
    it('simple HELLO', async () => {
      await setup('HELLO')
      expect(api.log.join('|')).to.be('response 😀')
    })
    it('trouble GOODBYE', async () => {
      await setup('GOODBYE')
      expect(api.log.join('|')).to.be("trouble GOODBYE doesn't name a block we know.")
    })
    it('trouble BadLuck', async () => {
      await setup('BadLuck')
      expect(api.log.join('|')).to.be('trouble Expected line to begin with all-caps keyword.')
    })

    it('CLICK HELLO', async () => {
      await setup('CLICK|_HELLO')
      await api.click(false)
      expect(api.log.join('|').replaceAll(tags, '')).to.be('response ▶|response 😀')
    })
    it('shift CLICK HELLO', async () => {
      await setup('CLICK|_HELLO')
      await api.click(true)
      expect(api.log.join('|').replaceAll(tags, '')).to.be('response ▶|inspect api|inspect debug|response 😀')
    })
    it('trouble CLICK', async () => {
      await setup('CLICK')
      expect(api.log.join('|').replaceAll(tags, '')).to.be('trouble CLICK expects indented blocks to follow.')
    })

    it('simple REPORT', async () => {
      await setup('REPORT', { temperature: '98.6°F' })
      var result = api.log.join('|').replaceAll(tags, '<$1>')
      expect(result).to.be('response <br><font>98.6°F</font>')
    })
    it('trouble REPORT', async () => {
      await setup('REPORT')
      var result = api.log.join('|').replaceAll(tags, '<$1>')
      expect(result).to.be('trouble Expect data, as from SENSOR.')
    })

    it('trouble FROM', async () => {
      api.files.push({ story: [{}] })
      await setup('FROM datalog')
      expect(api.log.join('|').replaceAll(tags, '')).to.be('trouble FROM expects indented blocks to follow.')
    })
    it('simple FROM', async () => {
      const text = api.files.push({ story: [{}] })
      await setup('FROM datalog|_HELLO')
      expect(api.log.join('|').replaceAll(tags, '')).to.be('response ⏳|fetch //datalog.json|response ⌛|response 😀')
    })

    it('see Testing Sensor Mech', async () => {
      api.files.length = 0
      api.files.push({ story: [{ type: 'datalog', text: 'SENSOR garage http://home.c2.com:8023' }] })
      api.files.push({ '28FF2E41': 203, '28FF6BCE': 203, '28FF9763': 202 })
      await setup('FROM datalog|_SENSOR garage|__REPORT')
      expect(api.log.join('|').replaceAll(tags, '')).to.be(
        'response ⏳|fetch //datalog.json|response ⌛|status |status  ⏳|fetch http://home.c2.com:8023|status  ⌛|response 54.80°F',
      )
    })

    it('simple SOURCE', async () => {
      api.files.length = 0
      const marker = { lat: '45.12', lon: '-122.67', label: 'Everywhere' }
      const map = id => ({ classList: ['item', 'map'], id, result: [marker] })
      const image = id => ({ classList: ['item', 'image'], id, result: marker })
      api.files.push([image('2938'), map('32380'), image('37923')])
      await setup('SOURCE marker')
      expect(api.log.join('|').replaceAll(tags, '')).to.be('source marker|status  ⇒ 1 map, 2 image')
    })
    it('see Testing Marker Mech', async () => {
      api.files.length = 0
      const marker = { lat: '45.12', lon: '-122.67', label: 'Everywhere' }
      const map = id => ({ classList: ['item', 'map'], id, result: [marker] })
      const image = id => ({ classList: ['item', 'image'], id, result: marker })
      api.files.push([image('2938'), map('32380'), image('37923')])
      const context = { title: 'Testing Sensor Mech', itemId: '38FD2E42' }
      await setup('SOURCE marker|_PREVIEW synopsis map', { context })
      expect(api.log.join('|').replaceAll(tags, '')).to.be('source marker|status  ⇒ 1 map, 2 image|show Mech Preview')
    })

    it('simple PREVIEW graph', async () => {
      const nodes = [{ type: 'one', in: [1], out: [1], props: {} }]
      const rels = [{ type: 'loop', from: 0, to: 0, props: {} }]
      const result = [{ name: 'first', graph: { nodes, rels } }]
      const aspect = [{ div: 'unused?', result }]
      const context = { title: 'Testing Sensor Mech', itemId: 'U4Q9RD22' }
      await setup('PREVIEW graph', { context, aspect })
      expect(api.log.join('|').replaceAll(tags, '')).to.be('show Mech Preview')
    })
    it('simple PREVIEW items', async () => {
      const items = [{ type: 'map', text: '45.12, -122.67 Everywhere' }]
      const context = { title: 'Testing Sensor Mech', itemId: '08OQWEIR' }
      await setup('PREVIEW items', { context, items })
      expect(api.log.join('|').replaceAll(tags, '')).to.be('show Mech Preview')
    })
    it('simple PREVIEW page', async () => {
      const story = [{ type: 'map', text: '45.12, -122.67 Everywhere' }]
      const page = { title: 'Map Page', story }
      const context = { title: 'Testing Sensor Mech', itemId: '084QIWEO' }
      await setup('PREVIEW page', { context, page })
      expect(api.log.join('|').replaceAll(tags, '')).to.be('show Mech Preview')
    })
    it('trouble PREVIEW foobar', async () => {
      const context = { title: 'Testing Sensor Mech', itemId: '923EDSVS' }
      await setup('PREVIEW foobar', { context })
      expect(api.log.join('|').replaceAll(tags, '')).to.be('trouble "foobar" doesn\'t name an item we can preview')
    })
  })
}).call(this)
