// mech plugin, server-side component
// These handlers are launched with the wiki server.

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as process from 'node:process'

function cors(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  next()
}

function startServer(params) {
  var app = params.app,
    argv = params.argv

  return app.get('/plugin/mech/run/:slug/:itemId', cors, (req, res, next) => {
    console.log(req.params)
    try {
      const slug = req.params.slug
      if (!slug.match(/^[a-z-]+$/)) return next()
      const itemId = req.params.itemId
      const mech = JSON.parse(atob(req.query.mech || 'W10='))
      const share = JSON.parse(atob(req.query.state || 'W10='))
      const context = { argv, slug }
      const state = Object.assign(share, { context })
      run(mech, state)
        .then(() => {
          delete state.context
          return res.json({ mech, state })
        })
        .catch(err => {
          console.log(err)
          return res.json({ err: err.message + ' from promise' })
        })
    } catch (err) {
      return res.json({ err: err.message + ' from try' })
    }
  })
}

// I N T E R P R E T E R

function status(elem, message) {
  elem.status = message
}

function trouble(elem, message) {
  elem.trouble = message
}

async function run(nest, state = {}, mock) {
  // const scope = nest.slice()
  // while (scope.length) {
  for (let here = 0; here < nest.length; here++) {
    // const code = scope.shift()
    const code = nest[here]
    if ('command' in code) {
      const command = code.command
      const elem = code
      const [op, ...args] = code.command.split(/ +/)
      const next = nest[here + 1]
      const body = next && 'command' in next ? null : nest[++here]
      const stuff = { command, op, args, body, elem, state }
      if (state.debug) console.log(stuff)
      if (blocks[op]) await blocks[op].emit.apply(null, [stuff])
      else if (op.match(/^[A-Z]+$/)) trouble(elem, `${op} doesn't name a block we know.`)
      else if (code.command.match(/\S/)) trouble(elem, `Expected line to begin with all-caps keyword.`)
    } else if (Array.isArray(code)) {
      console.warn(`this can't happen.`)
      run(code, state) // when does this even happen?
    }
  }
}

// B L O C K S

function hello_emit({ elem, args, state }) {
  const world = args[0] == 'world' ? ' 🌎' : ' 😀'
  status(elem, world)
}

function uptime_emit({ elem, args, state }) {
  const uptime = process.uptime()
  status(elem, uptime)
}

function sleep_emit({ elem, command, args, body, state }) {
  let count = args[0] || '1'
  if (!count.match(/^[1-9][0-9]?$/)) return trouble(elem, `SLEEP expects seconds from 1 to 99`)
  return new Promise(resolve => {
    if (body)
      run(body, state).then(result => {
        if (state.debug) console.log(command, 'children', result)
      })
    setTimeout(() => {
      resolve()
    }, 1000 * count)
  })
}

async function commons_emit({ elem, args, state }) {
  const readdir = dir => new Promise((res, rej) => fs.readdir(dir, (e, v) => (e ? rej(e) : res(v))))
  const stat = file => new Promise((res, rej) => fs.stat(file, (e, v) => (e ? rej(e) : res(v))))
  const tally = async dir => {
    const count = { files: 0, bytes: 0, items: [] }
    const items = await readdir(dir)
    for (const item of items) {
      const itemPath = path.join(dir, item)
      const stats = await stat(itemPath)
      if (state.debug) console.log({ itemPath, stats })
      if (stats.isFile() && !item.startsWith('.')) {
        count.files++
        count.bytes += stats.size
        count.items.push(item)
      }
    }
    return count
  }
  const all = await tally(state.context.argv.commons)
  const here = await tally(path.join(state.context.argv.data, 'assets', 'plugins', 'image'))
  state.commons = { all, here }
  const mb = count => (count.bytes / 1000000).toFixed(1)
  status(elem, `${mb(here)} / ${mb(all)} mb in ${here.files} / ${all.files} files`)
}

async function delta_emit({ elem, args, state }) {
  const readFile = path => new Promise((res, rej) => fs.readFile(path, (e, v) => (e ? rej(e) : res(v))))
  if (!state.recent) return trouble(elem, `DELTA expects "recent" update time in state.`)
  const file = path.join(state.context.argv.db, state.context.slug)
  const page = JSON.parse(await readFile(file))
  state.actions = page.journal.filter(action => action.date > state.recent)
  status(elem, `${state.actions.length} recent actions`)
}

// C A T A L O G

const blocks = {
  HELLO: { emit: hello_emit },
  UPTIME: { emit: uptime_emit },
  SLEEP: { emit: sleep_emit },
  COMMONS: { emit: commons_emit },
  DELTA: { emit: delta_emit },
}

export { startServer }
