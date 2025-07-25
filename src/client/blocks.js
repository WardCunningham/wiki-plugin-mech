import { soloListener, apply, requestSourceData, dotify, walks, kwic } from './library.js'
import { uniq, delay, asSlug } from './mech.js'
import ticker from 'universal-ticker'

export const api = {
  trouble,
  inspect,
  response,
  button,
  element,
  jfetch,
  status,
  sourceData,
  showResult,
  neighborhood,
  publishSourceData,
  newSVG,
  SVGline,
  ticker,
}

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

export function response(elem, html) {
  elem.innerHTML += html
}

export function button(elem, label, handler) {
  if (!elem.innerHTML.match(/button/)) {
    response(elem, `<button style="border-width:0;">${label}</button>`)
    elem.querySelector('button').addEventListener('click', handler)
  }
}

export function element(key) {
  return document.getElementById(key)
}

export async function jfetch(url) {
  return fetch(url).then(res => (res.ok ? res.json() : null))
}

export function status(elem, command, text) {
  elem.innerHTML = command + text
}

export function sourceData(elem, topic) {
  const item = elem.closest('.item')
  const sources = requestSourceData(item, topic).map(({ div, result }) => ({
    classList: [...div.classList],
    id: div.dataset.id,
    result,
  }))
  if (sources.length) return sources
  trouble(elem, `Expected source for "${topic}" in the lineup.`)
  return null
}

export function publishSourceData(elem, topic, data) {
  const item = elem.closest('.item')
  item.classList.add(`${topic}-source`)
  item[`${topic}Data`] = () => data
}

export function showResult(elem, page) {
  const options = { $page: $(elem.closest('.page')) }
  wiki.showResult(wiki.newPage(page), options)
}

export function neighborhood(want) {
  return Object.entries(wiki.neighborhoodObject.sites)
    .filter(([domain, site]) => !site.sitemapRequestInflight && (!want || domain.includes(want)))
    .map(([domain, site]) => (site.sitemap || []).map(info => Object.assign({ domain }, info)))
}

export function newSVG(elem) {
  const div = document.createElement('div')
  elem.closest('.item').firstElementChild.prepend(div)
  div.outerHTML = `
        <div style="border:1px solid black; background-color:#f8f8f8; margin-bottom:16px;">
          <svg viewBox="0 0 400 400" width=100% height=400>
            <circle id=dot r=5 cx=200 cy=200 stroke="#ccc"></circle>
          </svg>
        </div>`
  const svg = elem.closest('.item').getElementsByTagName('svg')[0]
  return svg
}

export function SVGline(svg, [x1, y1], [x2, y2]) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  const set = (k, v) => line.setAttribute(k, Math.round(v))
  set('x1', x1)
  set('y1', 400 - y1)
  set('x2', x2)
  set('y2', 400 - y2)
  line.style.stroke = 'black'
  line.style.strokeWidth = '2px'
  svg.appendChild(line)
  const dot = svg.getElementById('dot')
  dot.setAttribute('cx', Math.round(x2))
  dot.setAttribute('cy', Math.round(400 - y2))
}

// export function ticker(handler) {
//   const interval = setInterval(handler, 1000)
//   const stop = () => clearInterval(interval)
//   return { stop }
// }

export async function run(nest, state) {
  const scope = nest.slice()
  while (scope.length) {
    const code = scope.shift()
    if ('command' in code) {
      const command = code.command
      const elem = state.api ? state.api.element(code.key) : document.getElementById(code.key)
      const [op, ...args] = code.command.split(/ +/)
      const next = scope[0]
      const body = next && 'command' in next ? null : scope.shift()
      const stuff = { command, op, args, body, elem, state }
      if (state.debug) console.log(stuff)
      if (blocks[op]) await blocks[op].emit.apply(null, [stuff])
      else if (op.match(/^[A-Z]+$/)) state.api.trouble(elem, `${op} doesn't name a block we know.`)
      else if (code.command.match(/\S/)) state.api.trouble(elem, `Expected line to begin with all-caps keyword.`)
    }
  }
}

// B L O C K S

function click_emit({ elem, body, state }) {
  if (!body?.length) return state.api.trouble(elem, `CLICK expects indented blocks to follow.`)
  state.api.button(elem, '▶', event => {
    state.debug = event.shiftKey
    run(body, state)
  })
}

function hello_emit({ elem, args, state }) {
  const world = args[0] == 'world' ? ' 🌎' : ' 😀'
  for (const key of Object.keys(state)) state.api.inspect(elem, key, state)
  state.api.response(elem, world)
}

async function from_emit({ elem, args, body, state }) {
  if (!body?.length) return state.api.trouble(elem, `FROM expects indented blocks to follow.`)
  const url = args[0]
  state.api.response(elem, ' ⏳')
  state.page = await state.api.jfetch(`//${url}.json`)
  state.api.response(elem, ' ⌛')
  run(body, state)
}

function sensor_emit({ elem, command, args, body, state }) {
  state.api.status(elem, command, '')
  if (!('page' in state)) return state.api.trouble(elem, `Expect "page" as with FROM.`)
  state.api.inspect(elem, 'page', state)
  const datalog = state.page.story.find(item => item.type == 'datalog')
  if (!datalog) return state.api.trouble(elem, `Expect Datalog plugin in the page.`)
  const device = args[0]
  if (!device) return state.api.trouble(elem, `SENSOR needs a sensor name.`)
  const sensor = datalog.text
    .split(/\n/)
    .map(line => line.split(/ +/))
    .filter(fields => fields[0] == 'SENSOR')
    .find(fields => fields[1] == device)
  if (!sensor) return state.api.trouble(elem, `Expect to find "${device}" in Datalog.`)
  const url = sensor[2]

  const f = c => (9 / 5) * (c / 16) + 32
  const avg = a => a.reduce((s, e) => s + e, 0) / a.length
  state.api.status(elem, command, ' ⏳')
  state.api.jfetch(url).then(data => {
    if (state.debug) console.log({ sensor, data })
    state.api.status(elem, command, ' ⌛')
    const value = f(avg(Object.values(data)))
    state.temperature = `${value.toFixed(2)}°F`
    run(body, state)
  })
}

function report_emit({ elem, command, state }) {
  const value = state?.temperature
  if (!value) return state.api.trouble(elem, `Expect data, as from SENSOR.`)
  state.api.inspect(elem, 'temperature', state)
  state.api.response(elem, `<br><font face=Arial size=32>${value}</font>`)
}

function source_emit({ elem, command, args, body, state }) {
  if (!(args && args.length)) return state.api.trouble(elem, `Expected Source topic, like "markers" for Map markers.`)
  const topic = args[0]
  const sources = state.api.sourceData(elem, topic)
  if (!sources) return
  if (state.debug) console.log({ topic, sources })
  const count = type => {
    const count = sources.filter(source => source.classList.includes(type)).length
    return count ? `${count} ${type}` : null
  }
  const counts = [count('map'), count('image'), count('frame'), count('assets')].filter(count => count).join(', ')
  state.api.status(elem, command, ' ⇒ ' + counts)
  state[topic] = sources.map(({ id, result }) => ({ id, result }))
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
          return state.api.trouble(elem, `"map" preview expects "marker" state, like from "SOURCE marker".`)
        state.api.inspect(elem, 'marker', state)
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
          return state.api.trouble(elem, `"graph" preview expects "aspect" state, like from "SOURCE aspect".`)
        state.api.inspect(elem, 'aspect', state)
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
        if (!('items' in state))
          return state.api.trouble(elem, `"graph" preview expects "items" state, like from "KWIC".`)
        state.api.inspect(elem, 'items', state)
        story.push(...state.items)
        break
      case 'page':
        if (!('page' in state)) return state.api.trouble(elem, `"page" preview expects "page" state, like from "FROM".`)
        state.api.inspect(elem, 'page', state)
        story.push(...state.page.story)
        break
      case 'synopsis':
        const text2 = `This page created with Mech command: "${command}". See [[${state.context.title}]].`
        story.push({ type: 'paragraph', text: text2, id: state.context.itemId })
        break
      default:
        return state.api.trouble(elem, `"${type}" doesn't name an item we can preview`)
    }
  }
  const title = 'Mech Preview' + (state.tick ? ` ${state.tick}` : '')
  const page = { title, story }
  for (const item of page.story) item.id ||= (Math.random() * 10 ** 20).toFixed(0)
  const item = JSON.parse(JSON.stringify(page))
  const date = Date.now()
  page.journal = [{ type: 'create', date, item }]
  state.api.showResult(elem, page)
}

async function neighbors_emit({ elem, command, args, body, state }) {
  const belem = probe => state.api.element(probe.key)
  const want = args[0]
  const have = state.api.neighborhood(want)
  for (const probe of body || []) {
    if (!probe.command.endsWith(' Survey')) {
      state.api.trouble(belem(probe), `NEIGHBORS expects a Site Survey title, like Pattern Link Survey`)
      continue
    }
    const todos = have.filter(sitemap => sitemap.find(info => info.title == probe.command))
    state.api.status(belem(probe), probe.command, `⇒ ${todos.length} sites`)
    for (const todo of todos) {
      const url = `//${todo[0].domain}/${asSlug(probe.command)}.json`
      const page = await state.api.jfetch(url)
      if (!page) continue
      const survey = page.story.find(item => item.type == 'frame')?.survey
      if (!survey) continue
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
  state.api.status(elem, command, `⇒ ${state.neighborhood.length} pages, ${have.length} sites`)
}

function walk_emit({ elem, command, args, state }) {
  if (!('neighborhood' in state))
    return state.api.trouble(elem, `WALK expects state.neighborhood, like from NEIGHBORS.`)
  state.api.inspect(elem, 'neighborhood', state)
  const [, count, way] = command.match(/\b(\d+)? *(steps|days|weeks|months|hubs|lineup|references)\b/) || []
  if (!way && command != 'WALK') return tate.api.trouble(elem, `WALK can't understand rest of this block.`)
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
  const nodes = aspects.map(({ graph }) => graph.nodes).flat()
  state.api.status(elem, command, ` ⇒ ${aspects.length} aspects, ${nodes.length} nodes`)
  if (steps.find(({ graph }) => !graph)) state.api.trouble(elem, `WALK skipped sites with no links in sitemaps`)
  if (aspects.length) {
    state.aspect = state.aspect || []
    const obj = state.aspect.find(obj => obj.id == elem.id)
    if (obj) obj.result = aspects
    else state.aspect.push({ id: elem.id, result: aspects, source: command })
    // const item = elem.closest('.item')
    // item.classList.add('aspect-source')
    // item.aspectData = () => state.aspect.map(obj => obj.result).flat()
    state.api.publishSourceData(elem, 'aspect', state.aspect.map(obj => obj.result).flat())
    if (state.debug) console.log({ command, state: state.aspect, item: item.aspectData() })
  }
}

function tick_emit({ elem, command, args, body, state }) {
  console.log({ command, args, body, state })
  if (!body?.length) return state.api.trouble(elem, `TICK expects indented blocks to follow.`)
  const count = args[0] || '1'
  if (!count.match(/^[1-9][0-9]?$/)) return state.api.trouble(elem, `TICK expects a count from 1 to 99`)
  let clock, outertick
  if (state.tick != null) {
    outertick = state.tick
    start({ shiftKey: state.debug })
    return clock
  } else ready()

  function ready() {
    state.api.button(elem, '▶', start)
  }
  function status(ticks) {
    state.api.status(elem, command, ` ⇒ ${ticks} remaining`)
  }

  function start(event) {
    state.debug = event.shiftKey
    state.tick = +count
    status(state.tick)
    clock = state.api.ticker(async () => {
      if (state.debug) console.log({ tick: state.tick, count })
      if ('tick' in state && --state.tick >= 0) {
        status(state.tick)
        await run(body, state)
      } else {
        clock = clock.api.stop()
        state.tick = outertick
        state.api.status(elem, command, '')
        ready()
      }
    })
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
  if (args.length < 1)
    return state.api.trouble(elem, `FORWARD expects an argument, the number of steps to move a "turtle".`)
  state.turtle ??= { svg: state.api.newSVG(elem), position: [200, 200], direction: 0 }
  const steps = args[0]
  const theta = (state.turtle.direction * 2 * Math.PI) / 360
  const [x1, y1] = state.turtle.position
  state.turtle.position = [x1 + steps * Math.sin(theta), y1 + steps * Math.cos(theta)]
  state.api.SVGline(state.turtle.svg, [x1, y1], state.turtle.position)
  state.api.status(elem, command, ` ⇒ ${state.turtle.position.map(n => (n - 200).toFixed(1)).join(', ')}`)
}

function turn_emit({ elem, command, args, state }) {
  if (args.length < 1)
    return state.api.trouble(elem, `TURN expects an argument, the number of degrees to turn a "turtle".`)
  state.turtle ??= { svg: state.api.newSVG(elem), position: [200, 200], direction: 0 }
  const degrees = +args[0]
  state.turtle.direction += degrees
  state.api.status(elem, command, ` ⇒ ${state.turtle.direction}°`)
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
    const text = `# ${group.group}\n\n${group.quotes.map(quote => link(quote)).join('\n')}`
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
