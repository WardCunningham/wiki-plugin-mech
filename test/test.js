// build time tests for mech plugin
// see http://mochajs.org/

(function() {
  const mech = require('../client/mech'),
        expect = require('expect.js')

  describe('mech plugin', () => {
    describe('expand', () => {
      it('can make itallic', () => {
        var result = mech.expand('hello *world*')
        return expect(result).to.be('hello <i>world</i>')
      })
    })
  })

}).call(this)
