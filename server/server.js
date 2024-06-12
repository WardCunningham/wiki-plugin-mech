// mech plugin, server-side component
// These handlers are launched with the wiki server.


(function() {

  const fs = require('fs')
  const process = require('process')

  function startServer(params) {
    var app = params.app,
        argv = params.argv

    return app.get('/plugin/mech/run/:slug([a-z-]+)/:itemId', async (req, res) => {
      console.log(req.params)
      try {
        const slug = req.params.slug
        const itemId = req.params.itemId
        const args = JSON.parse(atob(req.query.args || 'W10='))
        const path = `${argv.db}/${slug}`
        // fs.readFile(path,(err,data) => {
        //   const page = JSON.parse(data)
        //   const item = page.story.find(item => item.id == itemId) || null
        //   return res.json({err,item,args});
        // })
        const context = {path}
        const state = {context}
        run(args,state)
        return res.json({args,state})

      } catch(err) {
        return res.json({err:err.message})
      }
    })
  }


  // I N T E R P R E T E R

  function status(elem,message) {
    elem.status = message
  }

  function trouble(elem,message) {
    elem.trouble = message
  }

  async function run (nest,state={},mock) {
    // const scope = nest.slice()
    // while (scope.length) {
    for (let here = 0; here < nest.length; here++) {
      // const code = scope.shift()
      const code = nest[here]
      if ('command' in code) {
        const command = code.command
        const elem = code
        const [op, ...args] = code.command.split(/ +/)
        const next = nest[here+1]
        const body = next && ('command' in next) ? null : nest[++here]
        const stuff = {command,op,args,body,elem,state}
        if(state.debug) console.log(stuff)
        if (blocks[op])
          blocks[op].emit.apply(null,[stuff])
        else
          if (op.match(/^[A-Z]+$/))
            trouble(elem,`${op} doesn't name a block we know.`)
          else if (code.command.match(/\S/))
            trouble(elem, `Expected line to begin with all-caps keyword.`)
      } else if(typeof code == 'array') {
        console.warn(`this can't happen.`)
        run(code,state) // when does this even happen?
      }
    }
  }

  // B L O C K S

  function hello_emit ({elem,args,state}) {
    const world = args[0] == 'world' ? ' 🌎' : ' 😀'
    status(elem,world)
  }

  function uptime_emit ({elem,args,state}) {
    const uptime = process.uptime()
    status(elem,uptime)
  }


  // C A T A L O G

  const blocks = {
    HELLO:   {emit:hello_emit},
    UPTIME:  {emit:uptime_emit}
  }


  module.exports = {startServer}

}).call(this)
