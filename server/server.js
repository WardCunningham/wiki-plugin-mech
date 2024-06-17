// mech plugin, server-side component
// These handlers are launched with the wiki server.


(function() {

  const fs = require('fs')
  const process = require('process')

  function startServer(params) {
    var app = params.app,
        argv = params.argv

    return app.get('/plugin/mech/run/:slug([a-z-]+)/:itemId', (req, res, next) => {
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

        valueStream([state]).pipe(run(args,state)).pipe(respondJSON(res, args))

        // return res.json({args,state})

      } catch(err) {
        res.json({err:err.message})
        next(err)
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

  function run (nest,state={},mock) {
    // const scope = nest.slice()
    // while (scope.length) {

    // We start w/ a through stream that can be written into by the
    // caller of run if needed, but won't be for the main call
    const origin = mapStream()
    let source = origin
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
        // Each block gets its output fed to the next blocks input
        if (blocks[op])
          source = source.pipe(blocks[op].emit.apply(null,[stuff]))
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

    return origin
  }

  // B L O C K S

  function hello_emit ({elem,args,state}) {
    return mapStream(function (data) {
      const world = args[0] == 'world' ? ' 🌎' : ' 😀'
      status(elem,world)
      return world
    })
  }

  function uptime_emit ({elem,args,state}) {
    return mapStream(function (data) {
      const uptime = process.uptime()
      status(elem,uptime)
      return uptime
    })
  }


  // C A T A L O G

  const blocks = {
    HELLO:   {emit:hello_emit},
    UPTIME:  {emit:uptime_emit}
  }

  // S T R E A M S
  
  function base () {
    return {
      paused: true,
      ended: false,
      sink: null,
      source: null,
      resume: function () {
        if(!(this.paused = this.sink.paused) && this.source) {
          this.source.resume()
        }
      },

      write: function (data) {
        if (this.sink) {
          this.paused = this.sink.paused
        }
      },

      pipe: function (sink) {
        this.sink = sink
        sink.source = this
        if (!sink.paused) this.resume()
        while (sink.sink) {
          sink = sink.sink
        }
        return sink
      },
      
      abort: function (err) {
        if (this.source) this.source.abort(err)
        else this.end(err)
      },

      end: function (err) {
        this.ended = true
        this.paused = true
        if (this.sink) {
          this.sink.end(err)
        }
      }
    }
  }

  function mapStream (fn) {
    const stream = base()
    stream.write = function (data) {
      if (fn == null) {
        fn = function (a) { return a }
      }
      this.sink.write(fn.call(this,data))
      this.paused = this.sink.paused
    }
    return stream
  }

  function asyncMapStream (fn) {
    const stream = base()
    stream.write = function (data) {
      this.paused = true
      fn.call(this, data, (err, mapped) => {
        if (err) return this.abort(err)
        this.sink.write(mapped)
        this.paused = this.sink.paused
        this.resume()
      })
    }
    return stream
  }

  function filterStream (fn) {
    const stream = base()
    stream.write = function (data) {
      if (fn == null) {
        fn = function (a) { return a }
      }
      const pass = fn.call(this,data)
      if (pass) {
        this.sink.write(data)
      }
      this.paused = this.sink.paused
    }
    return stream
  }

  function devnull () {
    let stream = base()

    stream.paused = false

    return stream
  }

  function valueStream (values) {
    let stream = base() 
    let it = values[Symbol.iterator]()
    stream.resume = function () {
      while (!this.sink.paused && !this.ended) {
        let step = it.next()
        if (step.done) this.end()
        else this.sink.write(step.value)
      }
    }
    return stream
  }

  function collect (cb) {
    let stream = base()
    let items = []

    stream.write = function (data) {
      items.push(data)
    }

    stream.end = function (err) {
      this.ended = true
      this.paused = true
      cb(err, items)
      if (this.sink) {
        this.sink.end(err)
      }
    }

    stream.paused = false

    return stream
  }

  function respondJSON (res, args) {
    let stream = collect((err, items) => {
      res.json({args, items})
    })
    return stream
  }

  module.exports = {startServer}

}).call(this)
