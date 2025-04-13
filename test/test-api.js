import { describe, it } from 'node:test'
import expect from 'expect.js'
import { api } from '../src/client/blocks.js'
;(function () {
  const tags = /<(\/?.\w+).*?>/g

  const elem = {
    get innerText() {
      return 'block '
    },
    get innerHTML() {
      return 'block '
    },
    set innerHTML(html) {
      this.log.push(html)
    },
    get outerHTML() {
      return 'prefix '
    },
    set outerHTML(html) {
      this.log.push(html)
    },
    querySelector(selector) {
      return elem
    },
    addEventListener(topic, handler) {
      this.log.push(`on ${topic}`)
      this.handler = handler
      return elem
    },
    log: [],
    handler: null,
  }

  const event = {
    get shiftKey() {
      return true
    }
  }

  describe('api for reporting', () => {
    it('trouble', async () => {
      await api.trouble(elem, 'data')
      await elem.handler.call(event)
      expect(elem.log.join('|').replaceAll(tags, '')).to.be('block ✖︎|on click|prefix data')
    })
  })
}).call(this)
