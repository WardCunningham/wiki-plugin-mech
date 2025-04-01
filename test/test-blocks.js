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
  log: [],
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
  })
}).call(this)
