// mech plugin, server-side component
// These handlers are launched with the wiki server.


(async function() {

  const fs = require('fs')
  const path = require('path')
  const process = require('process')

  module.exports = {startServer}

  const {
    base,
    flat,
    respondJSON,
    collect,
    valueStream,
    devnull,
    filterStream,
    mapStream,
    asyncMapStream
  } = await import('../client/push-s.mjs')

  const { createRunner } = await import('../client/shared.mjs')


  // C A T A L O G
  const blocks = {
    HELLO:   {emit:hello_emit},
    UPTIME:  {emit:uptime_emit},
    SLEEP:   {emit:sleep_emit},
    COMMONS: {emit:commons_emit},
    DELTA:   {emit:delta_emit}
  }

  const run = createRunner(blocks)


  function cors (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    next()
  }

  function startServer(params) {
    var app = params.app,
        argv = params.argv

    return app.get('/plugin/mech/run/:slug([a-z-]+)/:itemId', cors, (req, res, next) => {
      console.log(req.params)
      try {
        const slug = req.params.slug
        const itemId = req.params.itemId
        const mech = JSON.parse(atob(req.query.mech || 'W10='))
        const share = JSON.parse(atob(req.query.state ||'W10='))
        const context = {argv,slug}
        const state = Object.assign(share,{context})

        valueStream([state]).pipe(run(mech,state)).pipe(respondJSON(res, mech))

      } catch(err) {
        res.json({err:err.message})
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

  function sleep_emit ({elem,command,args,body,state}) {
    let count = args[0] || '1'
    if (!count.match(/^[1-9][0-9]?$/)) return trouble(elem,`SLEEP expects seconds from 1 to 99`)
    return new AsyncMapStream(function (data, next) {
      let dreams = run(children, state)
      setTimeout(function () {
        dreams.abort()
        next(null, data)
      }, 1000 * count)
    })
  }

  function commons_emit ({elem,args,state}) {
    return asyncMapStream(async function (data, next) {
      const readdir = dir => new Promise((res,rej) =>
        fs.readdir(dir,(e,v) => e ? rej(e) : res(v)));
      const stat = file => new Promise((res,rej) =>
        fs.stat(file,(e,v) => e ? rej(e) : res(v)));
      const tally = async dir => {
        const count = {files:0,bytes:0}
        const items = await readdir(dir)
        for(const item of items) {
          const itemPath = path.join(dir, item)
          const stats = await stat(itemPath)
          if (state.debug) console.log({itemPath,stats})
          if (stats.isFile()) {
            count.files++
            count.bytes+=stats.size
          }
        }
        return count
      }
      try {
        const all = await tally(state.context.argv.commons)
        const here = await tally(path.join(state.context.argv.data,'assets','plugins','image'))
        state.commons = {all,here}
        status(elem,`${(all.bytes/1000000).toFixed(3)} mb in ${all.files} files`)
        next(null, here)
      } catch (e) {
        next(err)
      }
    })
  }

  function readDirStream () {
    const stream = asyncMap(function (data, next) {
      fs.readdir(data, next)
    })
    return stream
  }

  function statStream () {
    const stream = asyncMap(function (data, next) {
      fs.stat(data, next)
    })

    return stream
  }

  async function delta_emit ({elem,args,state}) {
    return asyncMapStream(async function (data, next) {
      const readFile = path => new Promise((res,rej) =>
        fs.readFile(path,(e,v) => e ? rej(e) : res(v)));
      if(!state.recent) return trouble(elem,`DELTA expects "recent" update time in state.`)
      const file = path.join(state.context.argv.db,state.context.slug)
      const page = JSON.parse(await readFile(file))
      next(null, page.journal
        .filter(action => action.date > state.recent)
      )
      status(elem,`${state.actions.length} recent actions`)
    })
  }

}).call(this)
