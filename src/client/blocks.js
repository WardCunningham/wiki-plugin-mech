import { soloListener, apply, requestSourceData, dotify, walks } from './library.js'
import { uniq, delay, asSlug } from './mech.js'

export function trouble(elem, message) {
  if (elem.innerText.match(/✖︎/)) return
  elem.innerHTML += `<button style="border-width:0;color:red;">✖︎</button>`
  elem.querySelector('button').addEventListener('click', event => {
    elem.outerHTML += `<span style="width:80%;color:gray;">${message}</span>`
  })
}

export function inspect(elem, key, state) {
  const tap = elem.previousElementSibling
  if (state.debug) {
    const value = state[key]
    tap.innerHTML = `${key} ⇒ `
    tap.addEventListener('click', event => {
      console.log({ key, value })
      let look = tap.previousElementSibling
      if (!look?.classList.contains('look')) {
        const div = document.createElement('div')
        div.classList.add('look')
        tap.insertAdjacentElement('beforebegin', div)
        look = tap.previousElementSibling
      }
      let text = JSON.stringify(value, null, 1)
      if (text.length > 300) text = text.substring(0, 400) + '...'
      const css = `border:1px solid black; background-color:#f8f8f8; padding:8px; color:gray; word-break: break-all;`
      look.innerHTML = `<div style="${css}">${text}</div>`
    })
  } else {
    tap.innerHTML = ''
  }
}

export async function run(nest, state = {}, mock) {
  const scope = nest.slice()
  while (scope.length) {
    const code = scope.shift()
    if ('command' in code) {
      const command = code.command
      const elem = mock || document.getElementById(code.key)
      const [op, ...args] = code.command.split(/ +/)
      const next = scope[0]
      const body = next && 'command' in next ? null : scope.shift()
      const stuff = { command, op, args, body, elem, state }
      if (state.debug) console.log(stuff)
      if (blocks[op]) await blocks[op].emit.apply(null, [stuff])
      else if (op.match(/^[A-Z]+$/)) trouble(elem, `${op} doesn't name a block we know.`)
      else if (code.command.match(/\S/)) trouble(elem, `Expected line to begin with all-caps keyword.`)
    }
  }
}

// B L O C K S

function click_emit({ elem, body, state }) {
  if (elem.innerHTML.match(/button/)) return
  if (!body?.length) return trouble(elem, `CLICK expects indented blocks to follow.`)
  elem.innerHTML += '<button style="border-width:0;">▶</button>'
  elem.querySelector('button').addEventListener('click', event => {
    state.debug = event.shiftKey
    run(body, state)
  })
}

function hello_emit({ elem, args, state }) {
  const world = args[0] == 'world' ? ' 🌎' : ' 😀'
  for (const key of Object.keys(state)) inspect(elem, key, state)
  elem.innerHTML += world
}

function from_emit({ elem, args, body, state }) {
  const line = elem.innerHTML
  const url = args[0]
  elem.innerHTML = line + ' ⏳'
  fetch(`//${url}.json`)
    .then(res => res.json())
    .then(page => {
      state.page = page
      elem.innerHTML = line + ' ⌛'
      run(body, state)
    })
}

function sensor_emit({ elem, args, body, state }) {
  const line = elem.innerHTML.replaceAll(/ ⌛/g, '')
  if (!('page' in state)) return trouble(elem, `Expect "page" as with FROM.`)
  inspect(elem, 'page', state)
  const datalog = state.page.story.find(item => item.type == 'datalog')
  if (!datalog) return trouble(elem, `Expect Datalog plugin in the page.`)
  const device = args[0]
  if (!device) return trouble(elem, `SENSOR needs a sensor name.`)
  const sensor = datalog.text
    .split(/\n/)
    .map(line => line.split(/ +/))
    .filter(fields => fields[0] == 'SENSOR')
    .find(fields => fields[1] == device)
  if (!sensor) return trouble(elem, `Expect to find "${device}" in Datalog.`)
  const url = sensor[2]

  const f = c => (9 / 5) * (c / 16) + 32
  const avg = a => a.reduce((s, e) => s + e, 0) / a.length
  elem.innerHTML = line + ' ⏳'
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (state.debug) console.log({ sensor, data })
      elem.innerHTML = line + ' ⌛'
      const value = f(avg(Object.values(data)))
      state.temperature = `${value.toFixed(2)}°F`
      run(body, state)
    })
}

function report_emit({ elem, command, state }) {
  const value = state?.temperature
  if (!value) return trouble(elem, `Expect data, as from SENSOR.`)
  inspect(elem, 'temperature', state)
  elem.innerHTML = command + `<br><font face=Arial size=32>${value}</font>`
}

function source_emit({ elem, command, args, body, state }) {
  if (!(args && args.length)) return trouble(elem, `Expected Source topic, like "markers" for Map markers.`)
  const topic = args[0]
  const item = elem.closest('.item')
  const sources = requestSourceData(item, topic)
  if (!sources.length) return trouble(elem, `Expected source for "${topic}" in the lineup.`)
  const count = type => {
    const count = sources.filter(source => [...source.div.classList].includes(type)).length
    return count ? `${count} ${type}` : null
  }
  const counts = [count('map'), count('image'), count('frame'), count('assets')].filter(count => count).join(', ')
  if (state.debug) console.log({ topic, sources })
  elem.innerHTML = command + ' ⇒ ' + counts
  // state.assets = ?
  // state.aspect = ?
  // state.region = ?
  // state.marker = ?
  state[topic] = sources.map(({ div, result }) => ({ id: div.dataset.id, result }))
  if (body) run(body, state)
}

function preview_emit({ elem, command, args, state }) {
  const round = digits => (+digits).toFixed(7)
  const story = []
  const types = args
  for (const type of types) {
    switch (type) {
      case 'map':
        if (!('marker' in state))
          return trouble(elem, `"map" preview expects "marker" state, like from "SOURCE marker".`)
        inspect(elem, 'marker', state)
        const text = state.marker
          .map(marker => [marker.result])
          .flat(2)
          .map(latlon => `${round(latlon.lat)}, ${round(latlon.lon)} ${latlon.label || ''}`)
          .filter(uniq)
          .join('\n')
        story.push({ type: 'map', text })
        break
      case 'graph':
        if (!('aspect' in state))
          return trouble(elem, `"graph" preview expects "aspect" state, like from "SOURCE aspect".`)
        inspect(elem, 'aspect', state)
        for (const { div, result } of state.aspect) {
          for (const { name, graph } of result) {
            if (state.debug) console.log({ div, result, name, graph })
            story.push({ type: 'paragraph', text: name })
            story.push({ type: 'graphviz', text: dotify(graph) })
          }
          story.push({ type: 'pagefold', text: '.' })
        }
        break
      case 'items':
        if (!('items' in state)) return trouble(elem, `"graph" preview expects "items" state, like from "KWIC".`)
        inspect(elem, 'items', state)
        story.push(...state.items)
        break
      case 'page':
        if (!('page' in state)) return trouble(elem, `"page" preview expects "page" state, like from "FROM".`)
        inspect(elem, 'page', state)
        story.push(...state.page.story)
        break
      case 'synopsis':
        {
          const text = `This page created with Mech command: "${command}". See [[${state.context.title}]].`
          story.push({ type: 'paragraph', text, id: state.context.itemId })
        }
        break
      default:
        return trouble(elem, `"${type}" doesn't name an item we can preview`)
    }
  }
  const title = 'Mech Preview' + (state.tick ? ` ${state.tick}` : '')
  const page = { title, story }
  for (const item of page.story) item.id ||= (Math.random() * 10 ** 20).toFixed(0)
  const item = JSON.parse(JSON.stringify(page))
  const date = Date.now()
  page.journal = [{ type: 'create', date, item }]
  const options = { $page: $(elem.closest('.page')) }
  wiki.showResult(wiki.newPage(page), options)
}

async function neighbors_emit({ elem, command, args, body, state }) {
  const belem = probe => document.getElementById(probe.key)
  const want = args[0]
  if (state.debug) console.log({ neighborhoodObject: wiki.neighborhoodObject })
  const have = Object.entries(wiki.neighborhoodObject.sites)
    .filter(([domain, site]) => !site.sitemapRequestInflight && (!want || domain.includes(want)))
    .map(([domain, site]) => (site.sitemap || []).map(info => Object.assign({ domain }, info)))
  for (const probe of body || []) {
    if (!probe.command.endsWith(' Survey')) {
      trouble(belem(probe), `NEIGHBORS expects a Site Survey title, like Pattern Link Survey`)
      continue
    }
    const todos = have.filter(sitemap => sitemap.find(info => info.title == probe.command))
    belem(probe).innerHTML = `${probe.command} ⇒ ${todos.length} sites`
    for (const todo of todos) {
      const url = `//${todo[0].domain}/${asSlug(probe.command)}.json`
      const page = await fetch(url).then(res => res.json())
      const survey = page.story.find(item => item.type == 'frame')?.survey
      for (const info of todo) {
        const extra = Object.assign(
          {},
          survey.find(inf => inf.slug == info.slug),
          info,
        )
        Object.assign(info, extra)
      }
      console.log({ url, page, survey, todo })
    }
  }
  state.neighborhood = have.flat().sort((a, b) => b.date - a.date)
  elem.innerHTML = command + ` ⇒ ${state.neighborhood.length} pages, ${have.length} sites`
}

function walk_emit({ elem, command, args, state }) {
  if (!('neighborhood' in state)) return trouble(elem, `WALK expects state.neighborhood, like from NEIGHBORS.`)
  inspect(elem, 'neighborhood', state)
  const [, count, way] = command.match(/\b(\d+)? *(steps|days|weeks|months|hubs|lineup|references)\b/) || []
  if (!way && command != 'WALK') return trouble(elem, `WALK can't understand rest of this block.`)
  const scope = {
    lineup() {
      const items = [...document.querySelectorAll('.page')]
      const index = items.indexOf(elem.closest('.page'))
      return items.slice(0, index)
    },
    references() {
      const div = elem.closest('.page')
      const pageObject = wiki.lineup.atKey(div.dataset.key)
      const story = pageObject.getRawPage().story
      console.log({ div, pageObject, story })
      return story.filter(item => item.type == 'reference')
    },
  }
  const steps = walks(count, way, state.neighborhood, scope)
  const aspects = steps.filter(({ graph }) => graph)
  if (state.debug) console.log({ steps })
  elem.innerHTML = command
  const nodes = aspects.map(({ graph }) => graph.nodes).flat()
  elem.innerHTML += ` ⇒ ${aspects.length} aspects, ${nodes.length} nodes`
  if (steps.find(({ graph }) => !graph)) trouble(elem, `WALK skipped sites with no links in sitemaps`)
  const item = elem.closest('.item')
  if (aspects.length) {
    state.aspect = state.aspect || []
    const obj = state.aspect.find(obj => obj.id == elem.id)
    if (obj) obj.result = aspects
    else state.aspect.push({ id: elem.id, result: aspects, source: command })
    item.classList.add('aspect-source')
    item.aspectData = () => state.aspect.map(obj => obj.result).flat()
    if (state.debug) console.log({ command, state: state.aspect, item: item.aspectData() })
  }
}

function tick_emit({ elem, command, args, body, state }) {
  if (elem.innerHTML.match(/button/)) return
  if (!body?.length) return trouble(elem, `TICK expects indented blocks to follow.`)
  const count = args[0] || '1'
  if (!count.match(/^[1-9][0-9]?$/)) return trouble(elem, `TICK expects a count from 1 to 99`)
  let clock = null
  ready()
  function ready() {
    elem.innerHTML = command + '<button style="border-width:0;">▶</button>'
    elem.querySelector('button').addEventListener('click', start)
  }
  function start(event) {
    state.debug = event.shiftKey
    const status = ticks => {
      elem.innerHTML = command + ` ⇒ ${ticks} remaining`
    }
    if (clock) {
      clock = clearInterval(clock)
      delete state.tick
    } else {
      let working
      state.tick = +count
      status(state.tick)
      working = true
      run(body, state).then(() => (working = false))
      clock = setInterval(() => {
        if (working) return
        if (state.debug) console.log({ tick: state.tick })
        if ('tick' in state && --state.tick > 0) {
          status(state.tick)
          working = true
          run(body, state).then(() => (working = false))
        } else {
          clock = clearInterval(clock)
          ready()
        }
      }, 1000)
    }
  }
}

function until_emit({ elem, command, args, body, state }) {
  if (!args.length) return trouble(elem, `UNTIL expects an argument, a word to stop running.`)
  if (!state.tick) return trouble(elem, `UNTIL expects to indented below an iterator, like TICKS.`)
  if (!state.aspect) return trouble(elem, `UNTIL expects "aspect", like from WALK.`)
  inspect(elem, 'aspect', state)
  elem.innerHTML = command + ` ⇒ ${state.tick}`
  const word = args[0]
  for (const { div, result } of state.aspect)
    for (const { name, graph } of result)
      for (const node of graph.nodes)
        if (node.type.includes(word) || node.props.name.includes(word)) {
          if (state.debug) console.log({ div, result, name, graph, node })
          delete state.tick
          elem.innerHTML += ' done'
          if (body) run(body, state)
          return
        }
}

function forward_emit({ elem, command, args, state }) {
  if (args.length < 1) return trouble(elem, `FORWARD expects an argument, the number of steps to move a "turtle".`)
  if (!('turtle' in state)) state.turtle = new Turtle(elem)
  const steps = args[0]
  const position = state.turtle.forward(+steps)
  elem.innerHTML = command + ` ⇒ ${position.map(n => (n - 200).toFixed(1)).join(', ')}`
}

function turn_emit({ elem, command, args, state }) {
  if (args.length < 1) return trouble(elem, `TURN expects an argument, the number of degrees to turn a "turtle".`)
  if (!('turtle' in state)) state.turtle = new Turtle(elem)
  const degrees = args[0]
  const direction = state.turtle.turn(+degrees)
  elem.innerHTML = command + ` ⇒ ${direction}°`
}

function file_emit({ elem, command, args, body, state }) {
  if (!('assets' in state)) return trouble(elem, `FILE expects state.assets, like from SOURCE assets.`)
  inspect(elem, 'assets', state)

  // [ { "id": "b2d5831168b4706b", "result":
  //    { "pages/testing-file-mech":
  //     { "//ward.dojo.fed.wiki/assets":
  //      [ "KWIC-list+axe-files.txt", "KWIC-list-axe-files.tsv" ] } } } ]

  const origin = '//' + window.location.host
  const assets = state.assets
    .map(({ id, result }) =>
      Object.entries(result).map(([dir, paths]) =>
        Object.entries(paths).map(([path, files]) =>
          files.map(file => {
            const assets = path.startsWith('//') ? path : `${origin}${path}`
            const host = assets.replace(/\/assets$/, '')
            const url = `${assets}/${dir}/${file}`
            return { id, dir, path, host, file, url }
          }),
        ),
      ),
    )
    .flat(3)
  if (state.debug) console.log({ assets })

  if (args.length < 1) return trouble(elem, `FILE expects an argument, the dot suffix for desired files.`)
  if (!body?.length) return trouble(elem, 'FILE expects indented blocks to follow.')
  const suffix = args[0]
  const choices = assets.filter(asset => asset.file.endsWith(suffix))
  const flag = choice => `<img width=12 src=${choices[choice].host + '/favicon.png'}>`
  if (!choices) return trouble(elem, `FILE expects to find an asset with "${suffix}" suffix.`)
  elem.innerHTML =
    command +
    `<br><div class=choices style="border:1px solid black; background-color:#f8f8f8; padding:8px;" >${choices
      .map(
        (choice, i) =>
          `<span data-choice=${i} style="cursor:pointer;">
            ${flag(i)}
            ${choice.file} ▶
          </span>`,
      )
      .join('<br>\n')}</div>`
  elem.querySelector('.choices').addEventListener('click', event => {
    if (!('choice' in event.target.dataset)) return
    const url = choices[event.target.dataset.choice].url
    // console.log(event.target)
    // console.log(event.target.dataset.file)
    // const url = 'http://ward.dojo.fed.wiki/assets/pages/testing-file-mech/KWIC-list-axe-files.tsv'
    fetch(url)
      .then(res => res.text())
      .then(text => {
        elem.innerHTML = command + ` ⇒ ${text.length} bytes`
        state.tsv = text
        console.log({ text })
        run(body, state)
      })
  })
}

function kwic_emit({ elem, command, args, body, state }) {
  const template = body && body[0]?.command
  if (template && !template.match(/\$[KW]/)) return trouble(elem, `KWIK expects $K or $W in link prototype.`)
  if (!('tsv' in state)) return trouble(elem, `KWIC expects a .tsv file, like from ASSETS .tsv.`)
  inspect(elem, 'tsv', state)
  const prefix = args[0] || 1
  const lines = state.tsv.trim().split(/\n/)

  const stop = new Set(['of', 'and', 'in', 'at'])
  const page = $(elem.closest('.page')).data('data')
  const start = page.story.findIndex(item => item.type == 'pagefold' && item.text == 'stop')
  if (start >= 0) {
    const finish = page.story.findIndex((item, i) => i > start && item.type == 'pagefold')
    page.story
      .slice(start + 1, finish)
      .map(item => item.text.trim().split(/\s+/))
      .flat()
      .forEach(word => stop.add(word))
  }

  const groups = kwic(prefix, lines, stop)
  elem.innerHTML = command + ` ⇒ ${lines.length} lines, ${groups.length} groups`
  const link = quote => {
    let line = quote.line
    if (template) {
      const substitute = template
        .replaceAll(/\$K\+/g, quote.key.replaceAll(/ /g, '+'))
        .replaceAll(/\$K/g, quote.key)
        .replaceAll(/\$W/g, quote.word)
      const target = template.match(/\$W/) ? quote.word : quote.key
      line = line.replace(target, substitute)
    }
    return line
  }

  state.items = groups.map(group => {
    text = `# ${group.group}\n\n${group.quotes.map(quote => link(quote)).join('\n')}`
    return { type: 'markdown', text }
  })
}

function show_emit({ elem, command, args, state }) {
  elem.innerHTML = command
  let site, slug
  if (args.length < 1) {
    if (state.info) {
      inspect(elem, 'info', state)
      site = state.info.domain
      slug = state.info.slug
      elem.innerHTML = command + ` ⇒ ${state.info.title}`
    } else {
      return trouble(elem, `SHOW expects a slug or site/slug to open in the lineup.`)
    }
  } else {
    const info = args[0]
    ;[site, slug] = info.includes('/') ? info.split(/\//) : [null, info]
  }
  const lineup = [...document.querySelectorAll('.page')].map(e => e.id)
  if (lineup.includes(slug)) return trouble(elem, `SHOW expects a page not already in the lineup.`)
  const page = elem.closest('.page')
  wiki.doInternalLink(slug, page, site)
}

function random_emit({ elem, command, state }) {
  if (!state.neighborhood) return trouble(elem, `RANDOM expected a neighborhood, like from NEIGHBORS.`)
  inspect(elem, 'neighborhood', state)
  const infos = state.neighborhood
  const many = infos.length
  const one = Math.floor(Math.random() * many)
  elem.innerHTML = command + ` ⇒ ${one} of ${many}`
  state.info = infos[one]
}

function sleep_emit({ elem, command, args, body, state }) {
  let count = args[0] || '1'
  if (!count.match(/^[1-9][0-9]?$/)) return trouble(elem, `SLEEP expects seconds from 1 to 99`)
  return new Promise(resolve => {
    if (body)
      run(body, state).then(result => {
        if (state.debug) console.log(command, 'children', result)
      })
    elem.innerHTML = command + ` ⇒ ${count} remain`
    let clock = setInterval(() => {
      if (--count > 0) elem.innerHTML = command + ` ⇒ ${count} remain`
      else {
        clearInterval(clock)
        elem.innerHTML = command + ` ⇒ done`
        if (state.debug) console.log(command, 'done')
        resolve()
      }
    }, 1000)
  })
}

function together_emit({ elem, command, args, body, state }) {
  if (!body) return trouble(elem, `TOGETHER expects indented commands to run together.`)
  const children = body.map(child => run([child], state))
  return Promise.all(children)
}

// http://localhost:3000/plugin/mech/run/testing-mechs-synchronization/5e269010fc81aebe?args=WyJoZWxsbyIsIndvcmxkIl0
async function get_emit({ elem, command, args, body, state }) {
  if (!body) return trouble(elem, `GET expects indented commands to run on the server.`)
  let share = {}
  let where = state.context.site
  if (args.length) {
    for (const arg of args) {
      if (arg in state) {
        inspect(elem, arg, state)
        share[arg] = state[arg]
      } else if (arg.match(/\./)) where = arg
      else {
        return trouble(elem, `GET expected "${arg}" to name state or site.`)
      }
    }
  }
  // const site = state.context.site
  const slug = state.context.slug
  const itemId = state.context.itemId
  const query = `mech=${btoa(JSON.stringify(body))}&state=${btoa(JSON.stringify(share))}`
  const url = `//${where}/plugin/mech/run/${slug}/${itemId}?${query}`
  elem.innerHTML = command + ` ⇒ in progress`
  const start = Date.now()
  let result
  try {
    result = await fetch(url).then(res => (res.ok ? res.json() : res.status))
    if ('err' in result) return trouble(elem, `RUN received error "${result.err}"`)
  } catch (err) {
    return trouble(elem, `RUN failed with "${err.message}"`)
  }
  state.result = result
  for (const arg of result.mech.flat(9)) {
    const elem = document.getElementById(arg.key)
    if ('status' in arg) elem.innerHTML = arg.command + ` ⇒ ${arg.status}`
    if ('trouble' in arg) trouble(elem, arg.trouble)
  }
  if ('debug' in result.state) delete result.state.debug
  Object.assign(state, result.state)
  const elapsed = ((Date.now() - start) / 1000).toFixed(3)
  elem.innerHTML = command + ` ⇒ ${elapsed} seconds`
}

function delta_emit({ elem, command, args, body, state }) {
  const copy = obj => JSON.parse(JSON.stringify(obj))
  const size = obj => JSON.stringify(obj).length
  if (args.length < 1) return trouble(elem, `DELTA expects argument, "have" or "apply" on client.`)
  if (body) return trouble(elem, `DELTA doesn't expect indented input.`)
  switch (args[0]) {
    case 'have':
      const edits = state.context.page.journal.filter(item => item.type != 'fork')
      state.recent = edits[edits.length - 1].date
      elem.innerHTML = command + ` ⇒ ${new Date(state.recent).toLocaleString()}`
      break
    case 'apply':
      if (!('actions' in state)) return trouble(elem, `DELTA apply expect "actions" as input.`)
      inspect(elem, 'actions', state)
      const page = copy(state.context.page)
      const before = size(page)
      for (const action of state.actions) apply(page, action)
      state.page = page
      const after = size(page)
      elem.innerHTML = command + ` ⇒ ∆ ${(((after - before) / before) * 100).toFixed(1)}%`
      break
    default:
      trouble(elem, `DELTA doesn't know "${args[0]}".`)
  }
}

function roster_emit({ elem, command, state }) {
  if (!state.neighborhood) return trouble(elem, `ROSTER expected a neighborhood, like from NEIGHBORS.`)
  inspect(elem, 'neighborhood', state)
  const infos = state.neighborhood
  const sites = infos.map(info => info.domain).filter(uniq)
  const any = array => array[Math.floor(Math.random() * array.length)]
  if (state.debug) console.log(infos)
  const items = [
    { type: 'roster', text: 'Mech\n' + sites.join('\n') },
    { type: 'activity', text: `ROSTER Mech\nSINCE 30 days` },
  ]
  elem.innerHTML = command + ` ⇒ ${sites.length} sites`
  state.items = items
}

function lineup_emit({ elem, command, state }) {
  const items = [...document.querySelectorAll('.page')].map(div => {
    const $page = $(div)
    const page = $page.data('data')
    const site = $page.data('site') || location.host
    const slug = $page.attr('id').split('_')[0]
    const title = page.title || 'Empty'
    const text = page.story[0]?.text || 'empty'
    return { type: 'reference', site, slug, title, text }
  })
  elem.innerHTML = command + ` ⇒ ${items.length} pages`
  state.items = items
}

function listen_emit({ elem, command, args, state }) {
  if (args.length < 1) return trouble(elem, `LISTEN expects argument, an action.`)
  const topic = args[0]
  let recent = Date.now()
  let count = 0
  const handler = listen
  handler.action = 'publishSourceData'
  handler.id = elem.id
  window.addEventListener('message', listen)
  $('.main').on('thumb', (evt, thumb) => console.log('jquery', { evt, thumb }))
  elem.innerHTML = command + ` ⇒ ready`

  // window.listeners = (action=null) => {
  //   return getEventListeners(window).message
  //     .map(t => t.listener)
  //     .filter(f => f.name == 'listen')
  //     .map(f => ({action:f.action,elem:document.getElementById(f.id),count:f.count}))
  // }

  function listen(event) {
    console.log({ event })
    const { data } = event
    if (data.action == 'publishSourceData' && (data.name == topic || data.topic == topic)) {
      count++
      handler.count = count
      if (state.debug) console.log({ count, data })
      if (count <= 100) {
        const now = Date.now()
        const elapsed = now - recent
        recent = now
        elem.innerHTML = command + ` ⇒ ${count} events, ${elapsed} ms`
      } else {
        window.removeEventListener('message', listen)
      }
    }
  }
}

function message_emit({ elem, command, args, state }) {
  if (args.length < 1) return trouble(elem, `MESSAGE expects argument, an action.`)
  const topic = args[0]
  const message = {
    action: 'publishSourceData',
    topic,
    name: topic,
  }
  window.postMessage(message, '*')
  elem.innerHTML = command + ` ⇒ sent`
}

async function solo_emit({ elem, command, state }) {
  if (!('aspect' in state)) return trouble(elem, `"SOLO" expects "aspect" state, like from "WALK".`)
  inspect(elem, 'aspect', state)
  elem.innerHTML = command
  const todo = state.aspect.map(each => ({
    source: each.source || each.id,
    aspects: each.result,
  }))
  const aspects = todo.reduce((sum, each) => sum + each.aspects.length, 0)
  elem.innerHTML += ` ⇒ ${todo.length} sources, ${aspects} aspects`

  // from Solo plugin, client/solo.js
  const pageKey = elem.closest('.page').dataset.key
  const doing = { type: 'batch', sources: todo, pageKey }
  console.log({ pageKey, doing })

  if (typeof window.soloListener == 'undefined' || window.soloListener == null) {
    console.log('**** Adding solo listener')
    window.soloListener = soloListener
    window.addEventListener('message', soloListener)
  }

  await delay(750)
  const popup = window.open('/plugins/solo/dialog/#', 'solo', 'popup,height=720,width=1280')
  if (popup.location.pathname != '/plugins/solo/dialog/') {
    console.log('launching new dialog')
    popup.addEventListener('load', event => {
      console.log('launched and loaded')
      popup.postMessage(doing, window.origin)
    })
  } else {
    console.log('reusing existing dialog')
    popup.postMessage(doing, window.origin)
  }
}

// C A T A L O G

export const blocks = {
  CLICK: { emit: click_emit },
  HELLO: { emit: hello_emit },
  FROM: { emit: from_emit },
  SENSOR: { emit: sensor_emit },
  REPORT: { emit: report_emit },
  SOURCE: { emit: source_emit },
  PREVIEW: { emit: preview_emit },
  NEIGHBORS: { emit: neighbors_emit },
  WALK: { emit: walk_emit },
  TICK: { emit: tick_emit },
  UNTIL: { emit: until_emit },
  FORWARD: { emit: forward_emit },
  TURN: { emit: turn_emit },
  FILE: { emit: file_emit },
  KWIC: { emit: kwic_emit },
  SHOW: { emit: show_emit },
  RANDOM: { emit: random_emit },
  SLEEP: { emit: sleep_emit },
  TOGETHER: { emit: together_emit },
  GET: { emit: get_emit },
  DELTA: { emit: delta_emit },
  ROSTER: { emit: roster_emit },
  LINEUP: { emit: lineup_emit },
  LISTEN: { emit: listen_emit },
  MESSAGE: { emit: message_emit },
  SOLO: { emit: solo_emit },
}
