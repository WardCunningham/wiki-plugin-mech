// build time tests for mech plugin
// see http://mochajs.org/

import * as mech from '../src/client/mech.js'
import { describe, it } from 'node:test'
import expect from 'expect.js'
;(function () {
  // const mech = require('../src/client/mech')
  // const {describe,it} = require('node:test')
  // const expect = require('expect.js')
  const tags = /<(\/?.\w+).*?>/g

  describe('mech plugin', () => {
    describe('expand', () => {
      it('can use math notations', () => {
        var result = mech.expand('a < b && c > d')
        return expect(result).to.be('a &lt; b &amp;&amp; c &gt; d')
      })
    })

    describe('tree', () => {
      it('simple HELLO', () => {
        var lines = ['HELLO']
        var result = mech.tree(lines, [], 0)
        return expect(result[0].command).to.be('HELLO')
      })
      it('indented HELLO', () => {
        var lines = [' HELLO']
        var result = mech.tree(lines, [], 0)
        return expect(result[0][0].command).to.be('HELLO')
      })
      it('nested CLICK HELLO', () => {
        var lines = ['CLICK', ' HELLO', 'CLICK', ' HELLO world']
        var result = mech.tree(lines, [], 0)
        expect(result[0].command).to.be('CLICK')
        expect(result[1][0].command).to.be('HELLO')
        expect(result[2].command).to.be('CLICK')
        expect(result[3][0].command).to.be('HELLO world')
      })
    })

    describe('format', () => {
      it('simple HELLO', () => {
        var lines = ['HELLO']
        var nest = mech.tree(lines, [], 0)
        var html = mech.format(nest)
        var result = html.replaceAll(/<(\/?.\w+).*?>/g, '<$1>')
        expect(result).to.be('<font></font><span>HELLO</span>')
      })
      it('nested CLICK HELLO', () => {
        var lines = ['CLICK', ' HELLO']
        var nest = mech.tree(lines, [], 0)
        var html = mech.format(nest)
        var result = html.replaceAll(/<(\/?.\w+).*?>/g, '<$1>')
        expect(result).to.be('<font></font><span>CLICK</span>\n<div><font></font><span>HELLO</span></div>')
      })
    })

    describe('run', () => {
      it('simple HELLO', () => {
        var lines = ['HELLO']
        var nest = mech.tree(lines, [], 0)
        var state = {}
        var elem = {
          get innerHTML() {
            return 'HELLO'
          },
          set innerHTML(name) {
            this.log.push(name)
          },
          log: [],
        }
        mech.run(nest, state, elem)
        expect(elem.log.join('|')).to.be('HELLO 😀')
      })
      it('CLICK HELLO', async () => {
        var lines = ['CLICK', ' HELLO']
        var nest = mech.tree(lines, [], 0)
        var state = {}
        var handler
        var elem = {
          get innerHTML() {
            return 'CLICK'
          },
          set innerHTML(name) {
            this.log.push(name)
          },
          get querySelector() {
            return tag => elem
          },
          get addEventListener() {
            return (event, funct) => {
              this.log.push(event)
              handler = funct
            }
          },
          log: [],
        }
        var event = {
          get shiftKey() {
            return false
          },
        }
        await mech.run(nest, state, elem)
        await handler.apply(null, [event])
        expect(elem.log.join('|').replaceAll(/<.*?>/g, '')).to.be('CLICK▶|click')
      })
      it('simple REPORT', async () => {
        var lines = ['REPORT']
        var nest = mech.tree(lines, [], 0)
        var state = { temperature: '98.6°F' }
        var elem = {
          get innerHTML() {
            return 'REPORT'
          },
          set innerHTML(name) {
            this.log.push(name)
          },
          get previousElementSibling() {
            return elem
          },
          log: [],
        }
        await mech.run(nest, state, elem)
        var result = elem.log.join('|').replaceAll(tags, '<$1>')
        expect(result).to.be('|REPORT<br><font>98.6°F</font>')
      })
    })
  })
}).call(this)
