
(function() {

  const uniq = (value, index, self) => self.indexOf(value) === index

  function expand(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }


 // I N T E R P R E T E R

  // https://github.com/dobbs/wiki-plugin-graphviz/blob/main/client/graphviz.js#L86-L103
  function tree(lines, here, indent) {
    while (lines.length) {
      let m = lines[0].match(/( *)(.*)/)
      let spaces = m[1].length
      let command = m[2]
      if (spaces == indent) {
        here.push({command})
        lines.shift()
      } else if (spaces > indent) {
        var more = []
        here.push(more)
        tree(lines, more, spaces)
      } else {
        return here
      }
    }
    return here
  }

  function format(nest) {
    const unique = Math.floor(Math.random()*1000000)
    const block = (more,path) => {
      const html = []
      for (part of more) {
        const key = `${unique}.${path.join('.')}`
        part.key = key
        if('command' in part)
          html.push(`<font color=gray size=small></font><span style="display: block;" id=${key}>${expand(part.command)}</span>`)
        else
          html.push(`<div id=${key} style="padding-left:15px">${block(part,[...path,0])}</div>`)
        path[path.length-1]++
      }
      return html.join("\n")
    }
    return block(nest,[0])
  }

  function trouble(elem,message) {
    if(elem.innerText.match(/✖︎/)) return
    elem.innerHTML += `<button style="border-width:0;color:red;">✖︎</button>`
    elem.querySelector('button').addEventListener('click',event => {
      elem.outerHTML += `<span style="width:80%;color:gray;">${message}</span>` })
  }

  function inspect(elem,key,state) {
    const tap = elem.previousElementSibling
    if(state.debug) {
      const value = state[key]
      tap.innerHTML = `${key} ⇒ `
      tap.addEventListener('click',event => {
        console.log({key,value})
        let look = tap.previousElementSibling
        if (!(look?.classList.contains('look'))) {
          const div = document.createElement('div')
          div.classList.add('look')
          tap.insertAdjacentElement('beforebegin',div)
          look = tap.previousElementSibling
        }
        let text = JSON.stringify(value,null,1)
        if(text.length>300) text = text.substring(0,400)+'...'
        const css = `border:1px solid black; background-color:#f8f8f8; padding:8px; color:gray; word-break: break-all;`
        look.innerHTML = `<div style="${css}">${text}</div>`
      })
    }
    else {
      tap.innerHTML = ''
    }
  }

  async function run (nest,state={},mock) {
    const scope = nest.slice()
    while (scope.length) {
      const code = scope.shift()
      if ('command' in code) {
        const command = code.command
        const elem = mock || document.getElementById(code.key)
        const [op, ...args] = code.command.split(/ +/)
        const next = scope[0]
        const body = next && ('command' in next) ? null : scope.shift()
        const stuff = {command,op,args,body,elem,state}
        if(state.debug) console.log(stuff)
        if (blocks[op])
          await blocks[op].emit.apply(null,[stuff])
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

  function click_emit ({elem,body,state}) {
    if(elem.innerHTML.match(/button/)) return
    if (!body?.length) return trouble(elem,`CLICK expects indented blocks to follow.`)
    elem.innerHTML += '<button style="border-width:0;">▶</button>'
    elem.querySelector('button').addEventListener('click',event => {
      state.debug = event.shiftKey
      run(body,state)
    })
  }

  function hello_emit ({elem,args,state}) {
    const world = args[0] == 'world' ? ' 🌎' : ' 😀'
    for (const key of Object.keys(state))
      inspect(elem,key,state)
    elem.innerHTML += world
  }

  function from_emit ({elem,args,body,state}) {
    const line = elem.innerHTML
    const url = args[0]
    elem.innerHTML = line + ' ⏳'
    fetch(`//${url}.json`)
      .then(res => res.json())
      .then(page => {
        state.page = page
        elem.innerHTML = line + ' ⌛'
        run(body,state)
      })
  }

  function sensor_emit ({elem,args,body,state}) {
    const line = elem.innerHTML.replaceAll(/ ⌛/g,'')
    if(!('page' in state)) return trouble(elem,`Expect "page" as with FROM.`)
    inspect(elem,'page',state)
    const datalog = state.page.story.find(item => item.type == 'datalog')
    if(!datalog) return trouble(elem, `Expect Datalog plugin in the page.`)
    const device = args[0]
    if(!device) return trouble(elem, `SENSOR needs a sensor name.`)
    const sensor = datalog.text.split(/\n/)
      .map(line => line.split(/ +/))
      .filter(fields => fields[0] == 'SENSOR')
      .find(fields => fields[1] == device)
    if(!sensor) return trouble(elem, `Expect to find "${device}" in Datalog.`)
    const url = sensor[2]

    const f = c => 9/5*(c/16)+32
    const avg = a => a.reduce((s,e)=>s+e,0)/a.length
    elem.innerHTML = line + ' ⏳'
    fetch(url)
      .then (res => res.json())
      .then (data => {
        if(state.debug) console.log({sensor,data})
        elem.innerHTML = line + ' ⌛'
        const value = f(avg(Object.values(data)))
        state.temperature = `${value.toFixed(2)}°F`
        run(body,state)
      })
  }

  function report_emit ({elem,command,state}) {
    const value = state?.temperature
    if (!value) return trouble(elem,`Expect data, as from SENSOR.`)
    inspect(elem,'temperature',state)
    elem.innerHTML = command + `<br><font face=Arial size=32>${value}</font>`
  }

  function source_emit ({elem,command,args,body,state}) {
    if (!(args && args.length)) return trouble(elem,`Expected Source topic, like "markers" for Map markers.`)
    const topic = args[0]
    const item = elem.closest('.item')
    const sources = requestSourceData(item, topic)
    if(!sources.length) return trouble(elem,`Expected source for "${topic}" in the lineup.`)
    const count = type => {
      const count = sources
        .filter(source => [...source.div.classList].includes(type))
        .length
      return count ? `${count} ${type}` : null}
    const counts = [count('map'),count('image'),count('frame'),count('assets')]
      .filter(count => count)
      .join(", ")
    if (state.debug) console.log({topic,sources})
    elem.innerHTML = command + ' ⇒ ' + counts
    // state.assets = ?
    // state.aspect = ?
    // state.region = ?
    // state.marker = ?
    state[topic] = sources.map(({div,result}) => ({id:div.dataset.id, result}))
    if (body) run(body,state)
  }

  function preview_emit ({elem,command,args,state}) {
    const round = digits => (+digits).toFixed(7)
    const story = []
    const types = args
    for (const type of types) {
      switch (type) {
      case 'map':
        if(!('marker' in state)) return trouble(elem,`"map" preview expects "marker" state, like from "SOURCE marker".`)
        inspect(elem,'marker',state)
        const text = state.marker
          .map(marker => [marker.result])
          .flat(2)
          .map(latlon => `${round(latlon.lat)}, ${round(latlon.lon)} ${latlon.label||''}`)
          .filter(uniq)
          .join("\n")
        story.push({type:'map',text})
        break
      case 'graph':
        if(!('aspect' in state)) return trouble(elem,`"graph" preview expects "aspect" state, like from "SOURCE aspect".`)
        inspect(elem,'aspect',state)
        for (const {div,result} of state.aspect) {
          for (const {name,graph} of result) {
            if(state.debug) console.log({div,result,name,graph})
            story.push({type:'paragraph',text:name})
            story.push({type:'graphviz',text:dotify(graph)})
          }
          story.push({type:'pagefold',text:'.'})
        }
        break
      case 'items':
        if(!('items' in state)) return trouble(elem,`"graph" preview expects "items" state, like from "KWIC".`)
        inspect(elem,'items',state)
        story.push(...state.items)
        break
      case 'synopsis':
        {const text = `This page created with Mech command: "${command}". See [[${state.context.title}]].`
        story.push({type:'paragraph',text,id:state.context.itemId})}
        break
      default:
        return trouble(elem,`"${type}" doesn't name an item we can preview`)
      }
    }
    const title = "Mech Preview" + (state.tick ? ` ${state.tick}` : '')
    const page = {title,story}
    for (const item of page.story) item.id ||= (Math.random()*10**20).toFixed(0)
    const item = JSON.parse(JSON.stringify(page))
    const date = Date.now()
    page.journal = [{type:'create', date, item}]
    const options = {$page:$(elem.closest('.page'))}
    wiki.showResult(wiki.newPage(page), options)
  }

  function neighbors_emit ({elem,command,args,state}) {
    const want = args[0]
    if(state.debug) console.log({neighborhoodObject:wiki.neighborhoodObject})
    const have = Object.entries(wiki.neighborhoodObject.sites)
      .filter(([domain,site]) => !site.sitemapRequestInflight && (!want || domain.includes(want)))
      .map(([domain,site]) => (site.sitemap||[])
        .map(info => Object.assign({domain},info)))
    state.neighborhood = have.flat()
      .sort((a,b) => b.date - a.date)
    elem.innerHTML = command + ` ⇒ ${state.neighborhood.length} pages, ${have.length} sites`
  }

  function walk_emit ({elem,command,args,state}) {
    if(!('neighborhood' in state)) return trouble(elem,`FILE expects state.neighborhood, like from NEIGHBORS.`)
    inspect(elem,'neighborhood',state)
    const steps = walks(state.neighborhood)
    const aspects = steps.filter(({graph})=>graph)
    if(state.debug) console.log({steps})
    elem.innerHTML = command
    const nodes = aspects.map(({graph}) => graph.nodes).flat()
    elem.innerHTML += ` ⇒ ${aspects.length} aspects, ${nodes.length} nodes`
    if(steps.find(({graph}) => !graph)) trouble(elem,`WALK skipped sites with no links in sitemaps`)
    const item = elem.closest('.item')
    item.classList.add('aspect-source')
    item.aspectData = () => aspects
    state.aspect = [{id:item.dataset.id,result:aspects}]
  }

  function tick_emit ({elem,args,body,state}) {
    if(elem.innerHTML.match(/button/)) return
    if (!body?.length) return trouble(elem,`TICK expects indented blocks to follow.`)
    const count = args[0] || '1'
    if (!count.match(/^[1-9][0-9]?$/)) return trouble(elem,`TICK expects a count from 1 to 99`)
    let clock = null
    elem.innerHTML += '<button style="border-width:0;">▶</button>'
    elem.querySelector('button').addEventListener('click',event => {
      state.debug = event.shiftKey
      if(clock){
        clock = clearInterval(clock)
        delete state.tick
      } else {
        state.tick = +count
        run(body,state)
        clock = setInterval(()=>{
          if(state.debug) console.log({tick:state.tick})
          if(('tick' in state) && --state.tick > 0)
            run(body,state)
          else
            clock = clearInterval(clock)
        },1000)
      }
    })
  }

  function until_emit ({elem,command,args,body,state}) {
    if(!args.length) return trouble(elem,`UNTIL expects an argument, a word to stop running.`)
    if(!state.tick) return trouble(elem,`UNTIL expects to indented below an iterator, like TICKS.`)
    if(!state.aspect) return trouble(elem,`UNTIL expects "aspect", like from WALK.`)
    inspect(elem,'aspect',state)
    elem.innerHTML = command + ` ⇒ ${state.tick}`
    const word = args[0]
    for(const {div,result} of state.aspect)
      for(const {name,graph} of result)
        for(const node of graph.nodes)
          if(node.type.includes(word) || node.props.name.includes(word)) {
            if(state.debug) console.log({div,result,name,graph,node})
            delete state.tick
            elem.innerHTML += ' done'
            if (body) run(body,state)
            return
          }
  }

  function forward_emit ({elem,command,args,state}) {
    if(args.length < 1) return trouble(elem,`FORWARD expects an argument, the number of steps to move a "turtle".`)
    if(!('turtle' in state)) state.turtle = new Turtle(elem)
    const steps = args[0]
    const position = state.turtle.forward(+steps)
    elem.innerHTML = command + ` ⇒ ${position.map(n => (n-200).toFixed(1)).join(', ')}`
  }

  function turn_emit ({elem,command,args,state}) {
    if(args.length < 1) return trouble(elem,`TURN expects an argument, the number of degrees to turn a "turtle".`)
    if(!('turtle' in state)) state.turtle = new Turtle(elem)
    const degrees = args[0]
    const direction = state.turtle.turn(+degrees)
    elem.innerHTML = command + ` ⇒ ${direction}°`
  }

  function file_emit ({elem,command,args,body,state}) {
    if(!('assets' in state)) return trouble(elem,`FILE expects state.assets, like from SOURCE assets.`)
    inspect(elem,'assets',state)

  // [ { "id": "b2d5831168b4706b", "result":
  //    { "pages/testing-file-mech":
  //     { "//ward.dojo.fed.wiki/assets":
  //      [ "KWIC-list+axe-files.txt", "KWIC-list-axe-files.tsv" ] } } } ]

    const origin = '//'+window.location.host
    const assets = state.assets.map(({id,result}) =>
      Object.entries(result).map(([dir,paths]) =>
        Object.entries(paths).map(([path,files]) =>
          files.map(file => {
            const assets = path.startsWith("//") ? path : `${origin}${path}`
            const host = assets.replace(/\/assets$/,'')
            const url = `${assets}/${dir}/${file}`
            return {id,dir,path,host,file,url}
          })))).flat(3)
    if(state.debug) console.log({assets})

    if(args.length < 1) return trouble(elem,`FILE expects an argument, the dot suffix for desired files.`)
    if (!body?.length) return trouble(elem,'FILE expects indented blocks to follow.')
    const suffix = args[0]
    const choices = assets.filter(asset => asset.file.endsWith(suffix))
    const flag = choice => `<img width=12 src=${choices[choice].host+'/favicon.png'}>`
    if(!choices) return trouble(elem,`FILE expects to find an asset with "${suffix}" suffix.`)
    elem.innerHTML = command +
      `<br><div class=choices style="border:1px solid black; background-color:#f8f8f8; padding:8px;" >${choices
        .map((choice,i) =>
          `<span data-choice=${i} style="cursor:pointer;">
            ${flag(i)}
            ${choice.file} ▶
          </span>`)
        .join("<br>\n")
      }</div>`
    elem.querySelector('.choices').addEventListener('click',event => {
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
          console.log({text})
          run(body,state)
        })
    })
  }

  function kwic_emit ({elem,command,args,body,state}) {
    const template = body && body[0]?.command
    if(template && !template.match(/\$[KW]/)) return trouble(elem,`KWIK expects $K or $W in link prototype.`)
    if(!('tsv' in state)) return trouble(elem,`KWIC expects a .tsv file, like from ASSETS .tsv.`)
    inspect(elem,'tsv',state)
    const prefix = args[0] || 1
    const lines = state.tsv.trim().split(/\n/)

    const stop = new Set(['of','and','in','at'])
    const page = $(elem.closest('.page')).data('data')
    const start = page.story.findIndex(item => item.type=='pagefold' && item.text=='stop')
    if(start >= 0) {
      const finish = page.story.findIndex((item,i) => i>start && item.type=='pagefold')
      page.story.slice(start+1,finish)
        .map(item => item.text.trim().split(/\s+/))
        .flat()
        .forEach(word => stop.add(word))
    }

    const groups = kwic(prefix,lines,stop)
    elem.innerHTML = command + ` ⇒ ${lines.length} lines, ${groups.length} groups`
    const link = quote => {
      let line = quote.line
      if(template) {
        const substitute = template
          .replaceAll(/\$K\+/g,quote.key.replaceAll(/ /g,'+'))
          .replaceAll(/\$K/g,quote.key)
          .replaceAll(/\$W/g,quote.word)
        const target = template.match(/\$W/) ? quote.word : quote.key
        line = line.replace(target,substitute)
      }
      return line
    }

    state.items = groups.map(group => {
      text = `# ${group.group}\n\n${group.quotes
        .map(quote=>link(quote))
        .join("\n")}`
      return {type:'markdown',text}})
  }

  function show_emit({elem,command,args,state}) {
    elem.innerHTML = command
    let site,slug
    if(args.length < 1) {
      if(state.info) {
        inspect(elem,'info',state)
        site = state.info.domain
        slug = state.info.slug
        elem.innerHTML = command + ` ⇒ ${state.info.title}`
      } else {
        return trouble(elem,`SHOW expects a slug or site/slug to open in the lineup.`)
      }
    } else {
      const info = args[0]
      [site,slug] = info.includes('/')
        ? info.split(/\//)
        : [null,info]
    }
    const lineup = [...document.querySelectorAll('.page')].map(e => e.id)
    if(lineup.includes(slug)) return trouble(elem,`SHOW expects a page not already in the lineup.`)
    const page = elem.closest('.page')
    wiki.doInternalLink(slug,page,site)
  }

  function random_emit({elem,command,state}) {
    if(!state.neighborhood) return trouble(elem,`RANDOM expected a neighborhood, like from NEIGHBORS.`)
    inspect(elem,'neighborhood',state)
    const infos = state.neighborhood
    const many = infos.length
    const one = Math.floor(Math.random()*many)
    elem.innerHTML = command + ` ⇒ ${one} of ${many}`
    state.info = infos[one]
  }

  function sleep_emit({elem,command,args,body,state}) {
    let count = args[0] || '1'
    if (!count.match(/^[1-9][0-9]?$/)) return trouble(elem,`SLEEP expects seconds from 1 to 99`)
    return new Promise(resolve => {
      if(body)
        run(body,state)
          .then(result => {if(state.debug) console.log(command,'children', result)})
      elem.innerHTML = command + ` ⇒ ${count} remain`
      let clock = setInterval(()=> {
        if(--count > 0)
          elem.innerHTML = command + ` ⇒ ${count} remain`
        else {
          clearInterval(clock)
          elem.innerHTML = command + ` ⇒ done`
          if(state.debug) console.log(command, 'done')
          resolve()
        }
      }, 1000)
    })
  }

  function together_emit({elem,command,args,body,state}) {
    if (!body) return trouble(elem,`TOGETHER expects indented commands to run together.`)
    const children = body
      .map(child => run([child],state))
    return Promise.all(children)
  }


// C A T A L O G

  const blocks = {
    CLICK:   {emit:click_emit},
    HELLO:   {emit:hello_emit},
    FROM:    {emit:from_emit},
    SENSOR:  {emit:sensor_emit},
    REPORT:  {emit:report_emit},
    SOURCE:  {emit:source_emit},
    PREVIEW: {emit:preview_emit},
    NEIGHBORS:{emit:neighbors_emit},
    WALK:    {emit:walk_emit},
    TICK:    {emit:tick_emit},
    UNTIL:   {emit:until_emit},
    FORWARD: {emit:forward_emit},
    TURN:    {emit:turn_emit},
    FILE:    {emit:file_emit},
    KWIC:    {emit:kwic_emit},
    SHOW:    {emit:show_emit},
    RANDOM:  {emit:random_emit},
    SLEEP:   {emit:sleep_emit},
    TOGETHER:{emit:together_emit}
  }


// P L U G I N

  function emit($item, item) {
    const lines = item.text.split(/\n/)
    const nest = tree(lines,[],0)
    const html = format(nest)
    const $page = $item.parents('.page')
    const pageKey = $page.data("key")
    const context = {
      item,
      itemId: item.id,
      pageKey,
      page: wiki.lineup.atKey(pageKey).getRawPage(),
      origin: window.origin,
      site: $page.data("site") || window.location.host,
      slug: $page.attr("id"),
      title: $page.data("data").title,
    }
    const state = {context}
    $item.append(`<div style="background-color:#eee;padding:15px;border-top:8px;">${html}</div>`)
    run(nest,state)
  }

  function bind($item, item) {
    return $item.dblclick(() => {
      return wiki.textEditor($item, item);
    })
  }

  if (typeof window !== "undefined" && window !== null) {
    window.plugins.mech = {emit, bind}
  }

  if (typeof module !== "undefined" && module !== null) {
    module.exports = {expand,tree,format,run}
  }


// L I B R A R Y

  // adapted from wiki-plugin-frame/client/frame.js
  function requestSourceData(item, topic) {
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
      return {div,result}
    })
  }

  // adapted from super-collaborator/dotify.js
  function dotify(graph) {
    const tip = props => Object.entries(props).filter(e => e[1]).map(e => `${e[0]}: ${e[1]}`).join("\\n")
    const nodes = graph.nodes.map((node,id) => {
      const label = node.type ? `${node.type}\\n${node.props.name}` : node.props.name
      return `${id} [label="${label}" ${(node.props.url||node.props.tick)?`URL="${node.props.url||'#'}" target="_blank"`:''} tooltip="${tip(node.props)}"]`
    })
    const edges = graph.rels.map(rel => {
      return `${rel.from}->${rel.to} [label="${rel.type}" labeltooltip="${tip(rel.props)}"]`
    })
    return [
      'digraph {',
      'rankdir=LR',
      'node [shape=box style=filled fillcolor=palegreen]',
      ...nodes,
      ...edges,
      '}'].join("\n")
  }

  // inspired by aspects-of-recent-changes/roster-graphs.html
  function walks(neighborhood) {
    const prob = n => Math.floor(n * Math.abs(Math.random()-Math.random()))
    const rand = a => a[prob(a.length)]
    const domains = neighborhood
      .map(info => info.domain)
      .filter(uniq)
    return domains
      .map(domain => {
        const name = domain.split('.').slice(0,3).join('.')
        const done = new Set()
        const graph = new Graph()
        let nid = 0
        const here = neighborhood
          .filter(info => info.domain==domain && ('links' in info))
        if(!here.length) return {name,graph:null}
        const find = slug => neighborhood.find(info => info.slug == slug)
        const node = info => {
          nid = graph.addNode('',{
            name:info.title.replaceAll(/ /g,"\n"),
            title:info.title,
            site:domain,
            links:Object.keys(info.links||{}).filter(slug => find(slug))})
          return nid}
        const rel = (here,there) => graph.addRel('',here,there)
        const links = nid => graph.nodes[nid].props.links.filter(slug => !done.has(slug))
        const start = rand(here)
        done.add(start.slug)
        node(start)
        for (n=5;n>0;n--) {
          try {
            const slugs = links(nid)
            const slug = rand(slugs)
            done.add(slug)
            const info = find(slug)
            rel(nid,node(info))}
          catch (e) {}
        }
        return {name,graph}
      })
  }


  // adapted from testing-file-mech/testing-kwic.html
  function kwic(prefix,lines,stop) {
    const quotes = lines
      .filter(line => line.match(/\t/))
      .map(quote)
      .flat()
      .sort((a,b) => a.word<b.word ? -1 : 1)
    let current = 'zzz'.slice(0,prefix)
    const groups = []
    for (const quote of quotes) {
      const group = quote.word.toLowerCase().slice(0,prefix)
      if (group != current) {
        groups.push({group,quotes:[]})
        current = group}
      groups[groups.length-1].quotes.push(quote)
    }
    return groups

    function quote(line) {
      const [key,text] = line.split(/\t/)
      const words = text
        .replaceAll(/'t\b/g,'t')
        .replaceAll(/'s\b/g,'s')
        .split(/[^a-zA-Z]+/)
        .filter(word => word.length>3 && !stop.has(word.toLowerCase()))
      return words
        .map(word => ({word,line,key}))
    }
  }



  // adapted from graph/src/graph.js
  class Graph {

    constructor(nodes=[], rels=[]) {
      this.nodes = nodes;
      this.rels = rels;
    }

    addNode(type, props={}){
      const obj = {type, in:[], out:[], props};
      this.nodes.push(obj);
      return this.nodes.length-1;
    }

    addRel(type, from, to, props={}) {
      const obj = {type, from, to, props};
      this.rels.push(obj);
      const rid = this.rels.length-1;
      this.nodes[from].out.push(rid)
      this.nodes[to].in.push(rid);
      return rid;
    }

    stringify(...args) {
      const obj = { nodes: this.nodes, rels: this.rels }
      return JSON.stringify(obj, ...args)
    }

  }

  class Turtle {
    constructor(elem) {
      const size = elem
      const div = document.createElement('div')
      elem.closest('.item').firstElementChild.prepend(div)
      div.outerHTML = `
        <div style="border:1px solid black; background-color:#f8f8f8; margin-bottom:16px;">
          <svg viewBox="0 0 400 400" width=100% height=400>
            <circle id=dot r=5 cx=200 cy=200 stroke="#ccc"></circle>
          </svg>
        </div>`
      this.svg = elem.closest('.item').getElementsByTagName('svg')[0]
      this.position = [200,200]
      this.direction = 0
    }

    forward(steps) {
      const theta = this.direction*2*Math.PI/360
      const [x1,y1] = this.position
      const [x2,y2] = [x1+steps*Math.sin(theta), y1+steps*Math.cos(theta)]
      const line = document.createElementNS("http://www.w3.org/2000/svg", 'line')
      const set = (k,v) => line.setAttribute(k,Math.round(v))
      set("x1",x1); set("y1",400-y1)
      set("x2",x2); set("y2",400-y2)
      line.style.stroke = "black"
      line.style.strokeWidth = "2px"
      this.svg.appendChild(line)
      const dot = this.svg.getElementById('dot')
      dot.setAttribute('cx',Math.round(x2))
      dot.setAttribute('cy',Math.round(400-y2))
      this.position = [x2,y2]
      return this.position
    }

    turn(degrees) {
      this.direction += degrees
      return this.direction}
  }

}).call(this)
