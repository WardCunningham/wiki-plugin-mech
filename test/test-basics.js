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

  describe('mech plugin basics', () => {
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
      it('nested NEIGHBORS', () => {
        var lines = ['NEIGHBORS', ' JournalForkSurvey']
        var nest = mech.tree(lines, [], 0)
        var html = mech.format(nest)
        var result = html.replaceAll(/<(\/?.\w+).*?>/g, '<$1>')
        expect(result).to.be(
          '<font></font><span>NEIGHBORS</span>\n<div><font></font><span>JournalForkSurvey</span></div>',
        )
      })
    })
  })
}).call(this)
