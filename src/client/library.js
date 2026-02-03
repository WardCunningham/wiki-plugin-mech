import { uniq, delay, asSlug } from './mech.js'

// L I B R A R Y

// adapted from wiki-plugin-frame/client/frame.js
export function requestSourceData(item, topic) {
  let sources = []
  for (let div of document.querySelectorAll(`.item`)) {
    if (div.classList.contains(`${topic}-source`)) {
      sources.unshift(div)
    }
    if (div === item) {
      break
    }
  }

  return sources.map(div => {
    let getData = div[`${topic}Data`]
    let result = getData ? getData() : null
    return { div, result }
  })
}

// adapted from super-collaborator/dotify.js
export function dotify(graph) {
  const tip = props =>
    Object.entries(props)
      .filter(e => e[1])
      .map(e => `${e[0]}: ${e[1]}`)
      .join('\\n')
  const nodes = graph.nodes.map((node, id) => {
    const label = node.type ? `${node.type}\\n${node.props.name}` : node.props.name
    return `${id} [label="${label}" ${node.props.url || node.props.tick ? `URL="${node.props.url || '#'}" target="_blank"` : ''} tooltip="${tip(node.props)}"]`
  })
  const edges = graph.rels.map(rel => {
    return `${rel.from}->${rel.to} [label="${rel.type}" labeltooltip="${tip(rel.props)}"]`
  })
  return ['digraph {', 'rankdir=LR', 'node [shape=box style=filled fillcolor=palegreen]', ...nodes, ...edges, '}'].join(
    '\n',
  )
}

// inspired by aspects-of-recent-changes/roster-graphs.html
export function walks(count, way = 'steps', neighborhood, scope = {}) {
  const find = (slug, site) => neighborhood.find(info => info.slug == slug && (!site || info.domain == site))
  const finds = slugs => (slugs ? slugs.map(slug => find(slug)) : null)
  const prob = n => Math.floor(n * Math.abs(Math.random() - Math.random()))
  const rand = a => a[prob(a.length)]
  const good = info => info.links && Object.keys(info.links).length < 10
  const back = slug => neighborhood.filter(info => good(info) && slug in info.links)
  // const uniq = (value, index, self) => self.indexOf(value) === index
  const dedup = (value, index, self) => self.findIndex(info => info.slug == value.slug) === index
  const newr = infos =>
    infos
      .toSorted((a, b) => b.date - a.date)
      .filter(dedup)
      .slice(0, 3)
  const domains = neighborhood.map(info => info.domain).filter(uniq)

  function blanket(info) {
    // hub[0] => slug
    // find(slug) => info
    // node(info) => nid
    // back(slug) => infos
    // newr(infos) => infos

    const graph = new Graph()
    const node = info => {
      return graph.addUniqNode('', {
        name: info.title.replaceAll(/ /g, '\n'),
        title: info.title,
        site: info.domain,
      })
    }
    const up = info => finds(info?.patterns?.up) ?? newr(back(info.slug))
    const down = info => info?.patterns?.down ?? Object.keys(info.links || {})

    // hub
    const nid = node(info)

    // parents of hub
    for (const parent of up(info)) {
      graph.addRel('', node(parent), nid)
    }

    // children of hub
    for (const link of down(info)) {
      const child = find(link)
      if (child) {
        const cid = node(child)
        graph.addRel('', nid, cid)

        // parents of children of hub
        for (const parent of up(child)) {
          graph.addRel('', node(parent), cid)
        }
      }
    }
    return graph
  }

  switch (way) {
    case 'steps':
      return steps(count)
    case 'days':
      return periods(way, 1, count)
    case 'weeks':
      return periods(way, 7, count)
    case 'months':
      return periods(way, 30, count)
    case 'hubs':
      return hubs(count)
    case 'references':
      return references()
    case 'lineup':
      return lineup()
    case 'topics':
      return topics(count)
  }

  function steps(count = 5) {
    return domains.map(domain => {
      const name = domain.split('.').slice(0, 3).join('.')
      const done = new Set()
      const graph = new Graph()
      let nid = 0
      const here = neighborhood.filter(info => info.domain == domain && 'links' in info)
      if (!here.length) return { name, graph: null }
      const node = info => {
        nid = graph.addNode('', {
          name: info.title.replaceAll(/ /g, '\n'),
          title: info.title,
          site: domain,
          links: Object.keys(info.links || {}).filter(slug => find(slug)),
        })
        return nid
      }
      const rel = (here, there) => graph.addRel('', here, there)
      const links = nid => graph.nodes[nid].props.links.filter(slug => !done.has(slug))
      const start = rand(here)
      // const start = find('welcome-visitors')
      done.add(start.slug)
      node(start)
      for (let n = 5; n > 0; n--) {
        try {
          const slugs = links(nid)
          const slug = rand(slugs)
          done.add(slug)
          const info = find(slug)
          rel(nid, node(info))
        } catch (e) {}
      }
      return { name, graph }
    })
  }

  function periods(way, days, count = 12) {
    const interval = days * 24 * 60 * 60 * 1000
    const iota = [...Array(Number(count)).keys()]
    const dates = iota.map(n => Date.now() - n * interval)
    const aspects = []
    for (const stop of dates) {
      const start = stop - interval
      const name = `${way.replace(/s$/, '')} ${new Date(start).toLocaleDateString()}`
      const here = neighborhood
        .filter(info => info.date < stop && info.date >= start)
        .filter(info => !(info.links && Object.keys(info.links).length > 5))
      if (here.length) {
        const domains = here.reduce((set, info) => {
          set.add(info.domain)
          return set
        }, new Set())
        for (const domain of domains) {
          const graph = new Graph()
          const node = info => {
            return graph.addUniqNode('', {
              name: info.title.replaceAll(/ /g, '\n'),
              title: info.title,
              site: info.domain,
              date: info.date,
            })
          }
          const author = domain.split(/\.|\:/)[0]
          for (const info of here.filter(info => info.domain == domain)) {
            const nid = node(info)
            for (const link in info.links || {}) {
              const linked = find(link)
              if (linked) graph.addRel('', nid, node(linked))
            }
          }
          aspects.push({ name: `${name} ${author}`, graph })
        }
      }
    }
    return aspects
  }

  function hubs(count = 12) {
    const aspects = []
    const ignored = new Set()
    const hits = {}
    for (const info of neighborhood)
      if (info.links)
        if (Object.keys(info.links).length <= 15) {
          for (const link in info.links) if (find(link)) hits[link] = (hits[link] || 0) + 1
        } else {
          ignored.add(info.slug)
        }
    if (ignored.size > 0) console.log('hub links ignored for large pages:', [...ignored])
    const hubs = Object.entries(hits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
    console.log({ hits, hubs })

    for (const hub of hubs) {
      const name = `hub ${hub[1]} ${hub[0]}`
      const graph = blanket(find(hub[0]))
      aspects.push({ name, graph })
    }
    return aspects
  }

  function lineup() {
    const aspects = []
    const pageObjects = scope.lineup()
    console.log('library lineup', { scope, pageObjects })
    for (const pageObject of pageObjects) {
      const slug = pageObject.getSlug()
      const site = pageObject.getRemoteSite(scope.host())
      const info = find(slug, site)
      aspects.push({ name: pageObject.getTitle(), graph: blanket(info) })
    }
    return aspects
  }

  function references() {
    const aspects = []
    const items = scope.references()
    console.log('library references', { items })
    for (const item of items) {
      const { title, site, slug } = item
      const info = find(slug, site)
      if (info) aspects.push({ name: title, graph: blanket(info) })
    }
    return aspects
  }

  // adapted from aspects-of-recent-changes/roster-temporal-topics.html
  function topics(count = 10) {
    const aspects = []
    const days = 7
    const interval = days * 24 * 60 * 60 * 1000
    const msec = n => Date.now() - n * interval
    let week = 0
    while (aspects.length < count && week < count) {
      const stop = msec(week++)
      const start = msec(week)
      const nodes = neighborhood
        .filter(info => info.date > start && info.date <= stop)
        .filter(info => !!info.links)
        .filter(info => !info.title.endsWith(' Survey'))
      if (nodes.length) {
        const graph = linked(nodes)
        const name = new Date(stop).toLocaleDateString()
        // aspects.push({name,graph})
        aspects.push(...partitions({ name, graph }, start, stop))
      }
    }
    return aspects

    function linked(infos) {
      const graph = new Graph()
      const node = slug => {
        // const type = slug.includes('-and-') ? 'Prompt' : 'Page'
        const type = ''
        const info = neighborhood.find(info => info.slug == slug)
        const twins = neighborhood.filter(info => info.slug == slug).length
        const title = info.title
        const site = info.domain
        const date = info.date
        const name = title.replaceAll(' ', '\n')
        const nid = graph.nodes.findIndex(node => node.type == type && node.props.name == name)
        const result = nid >= 0 ? nid : graph.addNode(type, { name, site, date })
        if (twins > 1) graph.nodes[result].props.twins = twins
        return result
      }
      for (const info of infos) {
        const nid = node(info.slug)
        for (const name of newest(Object.keys(info.links))) {
          graph.addRel('', nid, node(name))
        }
      }
      return graph
    }

    function newest(slugs) {
      const recent = slug => neighborhood.filter(info => info.slug == slug)
      return slugs
        .map(slug => [slug, recent(slug)])
        .filter(pair => pair[1].length)
        .map(pair => [pair[0], pair[1].sort((a, b) => b.date - a.date)[0]])
        .sort((a, b) => b[1].date - a[1].date)
        .map(pair => pair[0])
        .slice(0, 3)
    }

    function partitions(aspect, from, until) {
      const input = aspect.graph
      const output = [] // graphs
      let doing = {} // nid => new nid
      // const checkpoint = () => {
      //   window.progress.innerText = output
      //     .map(graph => `${print(graph.nodes)}\n\n${print(graph.rels)}`)
      //     .join("\n\n")
      // }
      const nodes = input.nodes
      const rels = input.rels
      const todo = [...Array(nodes.length).keys()]
        .map(n => [n, Math.random()])
        .sort((a, b) => a[1] - b[1])
        .map(v => v[0])

      const copy = nid => {
        if (nid in doing) {
          // console.log('copied before', nid, 'doing', doing)
          return
        }
        // console.log('copy start', nid, 'doing', doing)
        todo.splice(todo.indexOf(nid), 1)
        const node = nodes[nid]
        doing[nid] = output[0].addNode(node.type, node.props)
        for (const rid of node.out) copy(rels[rid].to)
        for (const rid of node.in) copy(rels[rid].from)
        // console.log('linking',nid,'to',node.out.map(rid => rels[rid].to))
        for (const rid of node.out) output[0].addRel('', doing[nid], doing[rels[rid].to], {})
        // checkpoint()
      }

      // console.log('order todo',todo)
      while (todo.length) {
        const nid = todo.shift()
        // for (let nid of todo) {
        if (nid in doing) {
          // console.log('did',nid,'already')
          continue
        }
        const node = nodes[nid]
        const title = node.props.name.replaceAll('\n', ' ')
        if (node.in.length + node.out.length) {
          // console.log('doing',nid,title)
          output.unshift(new Graph())
          doing = {}
          copy(nid)
        }
        // else
        // console.log('skipping',nid,title)
      }

      const when = node => node.props.date || 0
      const topic = graph => {
        const node = graph.nodes
          .slice(0)
          .sort((a, b) => when(b) - when(a))
          .filter(a => when(a) >= from && when(a) <= until)[0]
        console.log({ node, nodes: graph.nodes, name: aspect.name })
        if (!node) return aspect.name
        const words = node.props.name.split(/\s+/)
        return words.slice(0, 3).join(' ')
      }

      return output.reverse().map((graph, i) => ({ name: topic(graph), graph }))
    }
  }
}

// adapted from testing-file-mech/testing-kwic.html
export function kwic(prefix, lines, stop) {
  const quotes = lines
    .filter(line => line.match(/\t/))
    .map(quote)
    .flat()
    .sort((a, b) => (a.word < b.word ? -1 : 1))
  let current = 'zzz'.slice(0, prefix)
  const groups = []
  for (const quote of quotes) {
    const group = quote.word.toLowerCase().slice(0, prefix)
    if (group != current) {
      groups.push({ group, quotes: [] })
      current = group
    }
    groups[groups.length - 1].quotes.push(quote)
  }
  return groups

  function quote(line) {
    const [key, text] = line.split(/\t/)
    const words = text
      .replaceAll(/'t\b/g, 't')
      .replaceAll(/'s\b/g, 's')
      .split(/[^a-zA-Z]+/)
      .filter(word => word.length > 3 && !stop.has(word.toLowerCase()))
    return words.map(word => ({ word, line, key }))
  }
}

// adapted from graph/src/graph.js
export class Graph {
  constructor(nodes = [], rels = []) {
    this.nodes = nodes
    this.rels = rels
  }

  addNode(type, props = {}) {
    const obj = { type, in: [], out: [], props }
    this.nodes.push(obj)
    return this.nodes.length - 1
  }

  addUniqNode(type, props = {}) {
    const nid = this.nodes.findIndex(node => node.type == type && node.props?.name == props?.name)
    return nid >= 0 ? nid : this.addNode(type, props)
  }

  addRel(type, from, to, props = {}) {
    const obj = { type, from, to, props }
    this.rels.push(obj)
    const rid = this.rels.length - 1
    this.nodes[from].out.push(rid)
    this.nodes[to].in.push(rid)
    return rid
  }

  stringify(...args) {
    const obj = { nodes: this.nodes, rels: this.rels }
    return JSON.stringify(obj, ...args)
  }
}

// adapted from wiki-client/lib/revision.coffee

// This module interprets journal actions in order to update
// a story or even regenerate a complete story from some or
// all of a journal.

export function apply(page, action) {
  const order = () => {
    return (page.story || []).map(item => item?.id)
  }

  const add = (after, item) => {
    const index = order().indexOf(after) + 1
    page.story.splice(index, 0, item)
  }

  const remove = () => {
    const index = order().indexOf(action.id)
    if (index !== -1) {
      page.story.splice(index, 1)
    }
  }

  page.story = page.story || []

  switch (action.type) {
    case 'create':
      if (action.item) {
        if (action.item.title != null) {
          page.title = action.item.title
        }
        if (action.item.story != null) {
          page.story = action.item.story.slice()
        }
      }
      break
    case 'add':
      add(action.after, action.item)
      break
    case 'edit':
      const index = order().indexOf(action.id)
      if (index !== -1) {
        page.story.splice(index, 1, action.item)
      } else {
        page.story.push(action.item)
      }
      break
    case 'move':
      // construct relative addresses from absolute order
      const moveIndex = action.order.indexOf(action.id)
      const after = action.order[moveIndex - 1]
      const item = page.story[order().indexOf(action.id)]
      remove()
      add(after, item)
      break
    case 'remove':
      remove()
      break
  }

  page.journal = page.journal || []
  if (action.fork) {
    // implicit fork
    page.journal.push({ type: 'fork', site: action.fork, date: action.date - 1 })
  }
  page.journal.push(action)
}

// adapted from Solo client

export function soloListener(event) {
  if (!event.data) return
  const { data } = event
  if (data?.action == 'publishSourceData' && data?.name == 'aspect') {
    if (wiki.debug) console.log('soloListener - source update', { event, data })
    return
  }

  // only continue if event is from a solo popup.
  // events from a popup window will have an opener
  // ensure that the popup window is one of ours

  if (!event.source.opener || event.source.location.pathname !== '/plugins/solo/dialog/') {
    if (wiki.debug) {
      console.log('soloListener - not for us', { event })
    }
    return
  }
  if (wiki.debug) {
    console.log('soloListener - ours', { event })
  }

  const { action, keepLineup = false, pageKey = null, title = null, context = null, page = null } = data

  let $page = null
  if (pageKey != null) {
    $page = keepLineup ? null : $('.page').filter((i, el) => $(el).data('key') == pageKey)
  }

  switch (action) {
    case 'doInternalLink':
      wiki.pageHandler.context = context
      wiki.doInternalLink(title, $page)
      break
    case 'showResult':
      const options = keepLineup ? {} : { $page }
      wiki.showResult(wiki.newPage(page), options)
      break
    default:
      console.error({ where: 'soloListener', message: 'unknown action', data })
  }
}

export function create(revIndex, data) {
  revIndex = +revIndex
  const revJournal = data.journal.slice(0, revIndex + 1)
  const revPage = { title: data.title, story: [] }
  for (const action of revJournal) {
    apply(revPage, action || {})
  }
  return revPage
}
